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
            const transactionsCollection = db.collection('transactions');
            const usersCollection = db.collection('users');
            
            const { status, userEmail, amount } = req.body;
            
            if (!status || !['pending', 'completed', 'cancelled'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }
            
            // Update transaction
            const result = await transactionsCollection.updateOne(
                { id: id },
                {
                    $set: {
                        status: status,
                        updatedAt: new Date(),
                        ...(status === 'completed' && { completedAt: new Date() }),
                        ...(status === 'cancelled' && { cancelledAt: new Date() })
                    }
                }
            );
            
            // If transaction is completed, add money to user balance
            if (status === 'completed' && userEmail) {
                // Get transaction to get amount
                const transaction = await transactionsCollection.findOne({ id: id });
                if (transaction && transaction.amount) {
                    await usersCollection.updateOne(
                        { email: userEmail },
                        {
                            $inc: { balance: transaction.amount },
                            $set: { updatedAt: new Date() }
                        },
                        { upsert: true }
                    );
                }
            }
            
            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error updating transaction:', error);
            res.status(500).json({ error: 'Failed to update transaction' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['PUT']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}
