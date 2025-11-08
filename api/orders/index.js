import { MongoClient } from 'mongodb';

// MongoDB connection string from Vercel environment variables
const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const ordersCollection = db.collection('orders');
            
            const order = {
                ...req.body,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const result = await ordersCollection.insertOne(order);
            
            res.status(200).json({ 
                success: true, 
                orderId: result.insertedId,
                order: order
            });
        } catch (error) {
            console.error('Error saving order:', error);
            res.status(500).json({ error: 'Failed to save order' });
        } finally {
            await client.close();
        }
    } else if (req.method === 'PUT') {
        // Handle order update by ID
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({ error: 'Order ID is required' });
        }
        
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
    } else if (req.method === 'GET') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const ordersCollection = db.collection('orders');
            
            const { userEmail, status } = req.query;
            
            let query = {};
            if (userEmail) {
                query.userEmail = decodeURIComponent(userEmail);
            }
            if (status) {
                query.status = status;
            }
            
            const orders = await ordersCollection
                .find(query)
                .sort({ createdAt: -1 })
                .toArray();
            
            res.status(200).json({ orders: orders });
        } catch (error) {
            console.error('Error getting orders:', error);
            res.status(500).json({ error: 'Failed to get orders' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['POST', 'GET', 'PUT']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}
