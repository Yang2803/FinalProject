"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface SearchResultItem {
  id: string;
  title: string;
  coverImage: string;
  description: string | null;
}
export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q");
  
  const [results, setResults] = useState<{
    animes: SearchResultItem[];
    mangas: SearchResultItem[];
  }>({ animes: [], mangas: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query) return;
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:5000/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [query]);

  if (loading) return <div className="p-10 text-white animate-pulse">Searching for {query}...</div>;

  const totalResults = results.animes.length + results.mangas.length;

  return (
    <div className="p-8 max-w-7xl mx-auto text-white">
      <h1 className="text-2xl font-bold mb-2">Search Results</h1>
      <p className="text-gray-400 mb-8">Found {totalResults} results for {query}</p>

      {totalResults === 0 ? (
        <div className="text-center py-20 bg-gray-900/50 rounded-3xl border border-gray-800">
           <p className="text-gray-500 mb-4">No results found in traditional database.</p>
           <Link href="/ai-search" className="text-cyan-400 font-bold hover:underline">
             Try asking our AI Assistant instead? ✨
           </Link>
        </div>
      ) : (
        <div className="space-y-12">
          {/* SECTION ANIME */}
          {results.animes.length > 0 && (
            <section>
              <h2 className="text-blue-400 font-bold text-lg mb-6 flex items-center gap-2">
                🎬 Anime <span>({results.animes.length})</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {results.animes.map(anime => (
                  <Link href={`/anime/${anime.id}`} key={anime.id} className="group">
                    <div className="aspect-[3/4] rounded-xl overflow-hidden mb-3 border border-gray-800 group-hover:border-blue-500 transition-all">
                      <img src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <h3 className="font-bold text-sm group-hover:text-blue-400 truncate">{anime.title}</h3>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* SECTION MANGA */}
          {results.mangas.length > 0 && (
            <section>
              <h2 className="text-purple-400 font-bold text-lg mb-6 flex items-center gap-2">
                📚 Manga <span>({results.mangas.length})</span>
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {results.mangas.map(manga => (
                  <Link href={`/manga/${manga.id}`} key={manga.id} className="group">
                    <div className="aspect-[3/4] rounded-xl overflow-hidden mb-3 border border-gray-800 group-hover:border-purple-500 transition-all">
                      <img src={manga.coverImage} alt={manga.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <h3 className="font-bold text-sm group-hover:text-purple-400 truncate">{manga.title}</h3>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}