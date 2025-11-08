import { MongoClient } from 'mongodb';

const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const marketplaceCollection = db.collection('marketplace');
            
            const sellerEmail = req.query.sellerEmail;
            
            let query = {};
            if (sellerEmail) {
                query.sellerEmail = sellerEmail;
            }
            
            const items = await marketplaceCollection.find(query).sort({ createdAt: -1 }).toArray();
            
            res.status(200).json({ items });
        } catch (error) {
            console.error('Error getting marketplace items:', error);
            res.status(500).json({ error: 'Failed to get marketplace items' });
        } finally {
            await client.close();
        }
    } else if (req.method === 'POST') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const marketplaceCollection = db.collection('marketplace');
            
            const { sellerEmail, name, description, image, price, quantity } = req.body;
            
            if (!sellerEmail || !name || !price || !quantity) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            
            const item = {
                sellerEmail: sellerEmail,
                name: name,
                description: description || '',
                image: image || 'https://via.placeholder.com/200',
                price: parseFloat(price),
                quantity: parseInt(quantity),
                sold: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const result = await marketplaceCollection.insertOne(item);
            res.status(200).json({ success: true, item: { ...item, _id: result.insertedId } });
        } catch (error) {
            console.error('Error creating marketplace item:', error);
            res.status(500).json({ error: 'Failed to create marketplace item' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

