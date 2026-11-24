import express, { Request, Response } from 'express';
import prisma from '../config/db';

const router = express.Router();

// 1. create a new community
router.post('/api/communities', async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, description, coverImage, creatorId } = req.body;
    
    // check if the community name already exists
    const existing = await prisma.community.findUnique({ where: { name } });
    if (existing) return res.status(400).json({ error: "Community name already exists!" });

    const community = await prisma.community.create({
      data: {
        name, description, coverImage, creatorId,
        members: { connect: { id: creatorId } } // Automatically make the creator a member.
      }
    });
    res.status(201).json(community);
  } catch (error) { res.status(500).json({ error: "Error creating community" }); }
});

// 2. GET LIST OF ALL COMMUNITIES (Including member counts)
router.get('/api/communities', async (req: Request, res: Response): Promise<any> => {
  try {
    const communities = await prisma.community.findMany({
      include: {
        _count: { select: { members: true, posts: true } },
        members: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(communities);
  } catch (error) { res.status(500).json({ error: "Error fetching list of communities" }); }
});

// 3. GET DETAIL OF A COMMUNITY (Including post list)
router.get('/api/communities/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const community = await prisma.community.findUnique({
      where: { id: req.params.id as string },
      include: {
        members: { select: { id: true, name: true} },
        posts: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { name: true } } }
        },
        _count: { select: { members: true } }
      }
    });
    if (!community) return res.status(404).json({ error: "Community not found" });
    res.status(200).json(community);
  } catch (error) { res.status(500).json({ error: "Error fetching community data" }); }
});

// 4. JOIN / LEAVE COMMUNITY (Join/Leave Button)
router.post('/api/communities/:id/join', async (req: Request, res: Response): Promise<any> => {
  try {
    const communityId = req.params.id as string;
    const { userId } = req.body;

    const community = await prisma.community.findUnique({
      where: { id: communityId },
      include: { members: { where: { id: userId } } }
    });

    if (!community) return res.status(404).json({ error: "Community not found" });

    const isMember = community.members.length > 0;

    if (isMember) {
      // Joined -> Click to Leave
      await prisma.community.update({
        where: { id: communityId },
        data: { members: { disconnect: { id: userId } } }
      });
      res.status(200).json({ message: "Left community", joined: false });
    } else {
      // Not a member -> Click to Join
      await prisma.community.update({
        where: { id: communityId },
        data: { members: { connect: { id: userId } } }
      });
      res.status(200).json({ message: "Joined community", joined: true });
    }
  } catch (error) { res.status(500).json({ error: "Error processing join request" }); }
});

// 5. UPDATE COMMUNITY INFORMATION (Admin Only)
router.put('/api/communities/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const communityId = req.params.id as string;
    const { name, description, coverImage, userId } = req.body;

    const community = await prisma.community.findUnique({ where: { id: communityId } });
    if (!community) return res.status(404).json({ error: "Community not found" });
    
    // Check admin privileges (only the creator can edit)
    if (community.creatorId !== userId) return res.status(403).json({ error: "You do not have permission to edit this community" });

    // Check for duplicate names (if Admin changes the name)
    if (name !== community.name) {
      const existing = await prisma.community.findUnique({ where: { name } });
      if (existing) return res.status(400).json({ error: "Community name already exists!" });
    }

    const updatedCommunity = await prisma.community.update({
      where: { id: communityId },
      data: { name, description, coverImage },
      include: {
        members: { select: { id: true, name: true } },
        posts: { orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } },
        _count: { select: { members: true } }
      }
    });

    res.status(200).json(updatedCommunity);
  } catch (error) { 
    console.error("Error updating community:", error);
    res.status(500).json({ error: "Error updating community" }); 
  }
});

export default router;