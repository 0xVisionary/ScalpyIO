import express from 'express';
import cors from 'cors';
import { createAgentRuntime, cleanupRuntime } from './agent.js';

const app = express();
app.use(cors());
app.use(express.json());

// Create new agent runtime
app.post('/create_agent', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const runtimeData = await createAgentRuntime(userId);
    res.json({ 
      success: true, 
      port: runtimeData.port,
      agentId: runtimeData.agentId 
    });
  } catch (error) {
    console.error('Failed to create agent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cleanup agent runtime
app.post('/cleanup_agent', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    await cleanupRuntime(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to cleanup agent:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Agent management server running on port ${PORT}`);
}); 