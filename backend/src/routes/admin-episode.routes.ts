import express from 'express';
import * as cheerio from 'cheerio';
import prisma from '../config/db';

const router = express.Router();

// Function for direct calls to Fandom's MediaWiki API 
async function fetchFandomApi(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Fetch Fandom API Error:", error);
    return null;
  }
}

router.post('/api/admin/episode/auto-fill', async (req, res) => {
  const { animeId, episodeNumber } = req.body;

  try {
    const anime = await prisma.anime.findUnique({
      where: { id: animeId }
    });

    if (!anime || !anime.fandomPrefix) {
      return res.status(400).json({ error: "The Fandom Prefix for Anime has not been configured!" });
    }

    const apiBase = `https://${anime.fandomPrefix}.fandom.com/api.php`;

    // =========================================================
    // PHASE 1: MULTI-LEVEL SEARCH AND HOLDING BEST MATCH TITLE
    // =========================================================
    let contentData: any = null;
    let bestMatchTitle: string = "";

    // ---------------------------------------------------------
    // 🛡️ LAYER 1: DIRECT LOOKUP (Inject `anime.title` to resolve Franchise Collision)
    // ---------------------------------------------------------
    const directTitles = [
      `${anime.title} Episode ${episodeNumber}`,                      // e.g., "Naruto Episode 1"
      `${anime.title} Episode ${String(episodeNumber).padStart(2, '0')}`, // e.g., "Naruto Episode 01"
      `Episode ${episodeNumber} (${anime.title})`,                    // e.g., "Episode 1 (Naruto)"
      `Episode ${episodeNumber}`,                                     // e.g., "Episode 1"
      `Episode ${String(episodeNumber).padStart(2, '0')}`,
      `Episode ${episodeNumber} (Anime)`
    ];

    for (const title of directTitles) {
      const parseUrl = `${apiBase}?action=parse&page=${encodeURIComponent(title)}&redirects=1&format=json&prop=text&origin=*`;
      const data = await fetchFandomApi(parseUrl);

      // 🌟 GATEKEEPER: Ensure the data is parsed and contains NO 'error' field.
      if (data && data.parse && !data.error) {
        contentData = data;
        bestMatchTitle = data.parse.title;
        break;
      }
    }

    // ---------------------------------------------------------
    // 🛡️ LAYER 2: IF LAYER 1 FAILS, USE SEARCH API
    // ---------------------------------------------------------
    if (!contentData) {
      // 🌟 Inject anime.title into search query to force Fandom system to return the correct anime
      const searchQuery = encodeURIComponent(`${anime.title} Episode ${episodeNumber}`);
      const searchUrl = `${apiBase}?action=query&list=search&srsearch=${searchQuery}&format=json&utf8=1&origin=*`;

      const searchData = await fetchFandomApi(searchUrl);
      const searchResults = searchData?.query?.search;

      if (searchResults && searchResults.length > 0) {
        const candidateTitle = searchResults[0].title;
        const contentUrl = `${apiBase}?action=parse&page=${encodeURIComponent(candidateTitle)}&redirects=1&format=json&prop=text&origin=*`;

        const data = await fetchFandomApi(contentUrl);
        if (data && data.parse && !data.error) {
          contentData = data;
          bestMatchTitle = data.parse.title;
        }
      }
    }

    // KCheck the locking mechanism before handing it to Cheerio.
    if (!contentData) {
      return res.status(404).json({ error: "Data for this episode could not be found on Fandom." });
    }

    const rawHtml = contentData.parse?.text?.['*'];

    if (!rawHtml) {
      return res.status(500).json({ error: "The returned HTML data is empty." });
    }

    // =========================================================
    // PHASE 2: CHEERIO DATA EXTRACTION (NO AI USED)
    // =========================================================
    const $ = cheerio.load(rawHtml);

    let extractedData = {
      plotSummary: "",
      characters: [] as string[],
      adaptedFrom: "Unknown" // Default value if not found
    };

    // A. PARSING "ADAPTED FROM"
    $('.pi-data-label').each((_, el) => {
      const labelText = $(el).text().toLowerCase();
      if (labelText.includes('manga') || labelText.includes('chapter') || labelText.includes('adapted')) {
        extractedData.adaptedFrom = $(el).next('.pi-data-value').text().trim();
      }
    });

    // =========================================================
    // B. PARSING "PLOT SUMMARY / PLOT DETAILS" (SMART FALLBACK)
    // =========================================================
    const potentialHeaders: { id: string, element: any, priority: number }[] = [];

    // 1. Scan the page, collect heading tags, and ASSIGN PRIORITY SCORES
    $('span.mw-headline').each((_: number, el: any) => {
      const id = $(el).attr('id')?.toLowerCase() || '';
      let priority = 99; // Default lowest priority

      if (id.includes('plot')) priority = 1;          // Priority 1: Plot Details, Plot...
      else if (id.includes('long')) priority = 2;     // Priority 2: Long Summary...
      else if (id.includes('summary')) priority = 3;  // Priority 3: Summary...
      else if (id.includes('synopsis')) priority = 4; // Priority 4: Synopsis...
      else if (id.includes('story')) priority = 5;    // Priority 5: Story...

      if (priority < 99) {
        potentialHeaders.push({ id: id, element: $(el).parent(), priority: priority });
      }
    });

    // Sort the array by priority (from 1 to 5)
    potentialHeaders.sort((a, b) => a.priority - b.priority);

    // 2. Iterate through each ranked card to READ A SAMPLE
    for (const header of potentialHeaders) {
      let tempText = ""; // Variable for temporary storage

      header.element.nextUntil('h2').each((_: number, el: any) => {
        if (el.tagName.toLowerCase() === 'p') {
          let paragraph = $(el).text().replace(/\[\d+\]/g, '').trim(); // Remove reference numbers such as [1], [2]

          // 🌟 FILTER: Ignore text indicating an incomplete page (stub)
          if (paragraph && !paragraph.toLowerCase().includes('this section is a stub')) {
            tempText += paragraph + "\n\n";
          }
        }
      });

      tempText = tempText.trim();

      // 3. FINALIZE RESULTS: If data is successfully extracted (longer than 10 characters), finalize and exit the loop!
      if (tempText.length > 10) {
        extractedData.plotSummary = tempText;
        break;
      }
    }

    // C. PARSING "CHARACTERS"
    let charHeader: any = null;

    // =========================================================
    // 1. SEARCH WITHIN MAIN CONTENT (Handles both Lists and Tables)
    // =========================================================
    $('span.mw-headline').each((_: number, el: any) => {
      const id = $(el).attr('id')?.toLowerCase() || '';

      if (id.includes('character') || id.includes('cast') || id.includes('credit')) {
        charHeader = $(el).parent();
        return false;
      }
    });

    if (charHeader && charHeader.length > 0) {
      const sectionContent = charHeader.nextUntil('h2');

      // 🌟 FIND ALL TABLES (Whether it's a root tag or wrapped in a div)
      const tables = sectionContent.filter('table').add(sectionContent.find('table'));

      // CASE A: If there are tables (Like the Credits section of Naruto)
      if (tables.length > 0) {
        tables.find('tr').each((_: number, tr: any) => {
          const firstCol = $(tr).find('td, th').first(); // Only get the first column

          let charName = firstCol.find('a').first().text().trim();
          if (!charName) charName = firstCol.text().trim();

          // Clean up (e.g., Naruto Uzumaki [1] -> Naruto Uzumaki)
          charName = charName.replace(/\[\d+\]/g, '').trim();

          if (charName && charName.length > 1 && charName.toLowerCase() !== 'role' && !charName.includes('File:') && !extractedData.characters.includes(charName)) {
            extractedData.characters.push(charName);
          }
        });
      }
      // CASE B: If it's a LIST (Like Jujutsu Kaisen, One Piece)
      else {
        sectionContent.find('li a').each((_: number, el: any) => {
          let charName = $(el).text().trim();
          charName = charName.replace(/\[\d+\]/g, '').trim();

          if (charName && charName.length > 1 && !charName.includes('File:') && !extractedData.characters.includes(charName)) {
            extractedData.characters.push(charName);
          }
        });
      }
    }

    // =========================================================
    // 2. OPTION B: CHECK THE INFOBOX (A fallback if the information is missing from the main content)
    // =========================================================
    if (extractedData.characters.length === 0) {
      const infoboxChars = $('.portable-infobox [data-source*="character" i], .portable-infobox [data-source*="Character" i]');

      if (infoboxChars.length > 0) {
        infoboxChars.find('a').each((_: number, el: any) => {
          const charName = $(el).text().trim();
          if (charName && charName.length > 1 && !charName.includes('File:') && !extractedData.characters.includes(charName)) {
            extractedData.characters.push(charName);
          }
        });
      } else {
        $('.portable-infobox h2, .portable-infobox h3, .portable-infobox .pi-header').each((_: number, el: any) => {
          if ($(el).text().toLowerCase().includes('character')) {
            $(el).parent().find('a').each((_: number, aEl: any) => {
              const charName = $(aEl).text().trim();
              if (charName && charName.length > 1 && !charName.includes('File:') && !extractedData.characters.includes(charName)) {
                extractedData.characters.push(charName);
              }
            });
          }
        });
      }
    }

    // =========================================================
    // 3. FINAL CLEANUP OF DATA
    // =========================================================
    extractedData.characters = extractedData.characters.filter(c => c.length > 1 && !c.includes('File:'));
    extractedData.plotSummary = extractedData.plotSummary.trim();

    res.status(200).json({
      success: true,
      data: extractedData,
      sourceTitle: bestMatchTitle
    });

  } catch (error) {
    console.error("Auto-fill Episode Error:", error);
    res.status(500).json({ error: "System error during automated data scraping and processing." });
  }
});

export default router;