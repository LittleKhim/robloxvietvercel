import { MongoClient } from 'mongodb';

// MongoDB connection string from Vercel environment variables
const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    const { id } = req.query;
    
    if (req.method === 'PUT') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const ordersCollection = db.collection('orders');
            
            const { status } = req.body;
            
            if (!status || !['pending', 'paid', 'cancelled'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }
            
            const result = await ordersCollection.updateOne(
                { code: id },
                {
                    $set: {
                        status: status,
                        updatedAt: new Date()
                    }
                }
            );
            
            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error updating order:', error);
            res.status(500).json({ error: 'Failed to update order' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['PUT']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

