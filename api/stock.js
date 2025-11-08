// Vercel Serverless Function - MongoDB Stock API
// Place this in /api/stock.js in your Vercel project

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        await client.connect();
        const db = client.db('store');
        const collection = db.collection('stock');
        
        const stock = await collection.findOne({});
        
        res.status(200).json(stock || {});
    } catch (error) {
        console.error('Error fetching stock:', error);
        res.status(500).json({ error: 'Failed to fetch stock' });
    } finally {
        await client.close();
    }
}

