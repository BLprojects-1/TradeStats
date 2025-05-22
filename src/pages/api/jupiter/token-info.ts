import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { TokenInfoResponse } from '../../../services/jupiterApiService';

const JUPITER_TOKEN_API = 'https://token.jup.ag/all';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mintAddress } = req.query;

  if (!mintAddress) {
    return res.status(400).json({ error: 'Mint address is required' });
  }

  try {
    const response = await axios.get<TokenInfoResponse[]>(JUPITER_TOKEN_API);
    const tokenInfo = response.data.find(token => token.address === mintAddress);

    if (!tokenInfo) {
      return res.status(404).json({ error: 'Token not found' });
    }

    return res.status(200).json(tokenInfo);
  } catch (error) {
    console.error('Error fetching Jupiter token info:', error);
    return res.status(500).json({ error: 'Failed to fetch token info' });
  }
} 