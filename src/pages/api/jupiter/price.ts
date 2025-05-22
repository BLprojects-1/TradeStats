import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const JUPITER_PRICE_API = 'https://price.jup.ag/v4';

interface JupiterPriceResponse {
  data: {
    [key: string]: {
      price: number;
    };
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenAddress, blockTime } = req.query;

  if (!tokenAddress) {
    return res.status(400).json({ error: 'Token address is required' });
  }

  try {
    // First get SOL price in USDC
    const solResponse = await axios.get<JupiterPriceResponse>(`${JUPITER_PRICE_API}/price`, {
      params: {
        ids: 'SOL',
        vsToken: 'USDC'
      }
    });

    const solPrice = solResponse.data.data.SOL.price;

    // Then get token price in SOL
    const tokenResponse = await axios.get<JupiterPriceResponse>(`${JUPITER_PRICE_API}/price`, {
      params: {
        ids: tokenAddress,
        vsToken: 'SOL'
      }
    });

    const tokenPriceInSol = tokenResponse.data.data[tokenAddress as string]?.price || 0;
    const tokenPriceInUsd = tokenPriceInSol * solPrice;

    return res.status(200).json({
      priceUsd: tokenPriceInUsd,
      priceSol: tokenPriceInSol,
      timestamp: blockTime || Date.now()
    });
  } catch (error) {
    console.error('Error fetching Jupiter price:', error);
    return res.status(500).json({ error: 'Failed to fetch price data' });
  }
} 