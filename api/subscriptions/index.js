import { MongoClient } from 'mongodb';

// MongoDB connection string
const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    // Handle check-renewal endpoint
    if (req.method === 'GET' && req.query.action === 'check-renewal') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const subscriptionsCollection = db.collection('subscriptions');
            const usersCollection = db.collection('users');
            
            const email = decodeURIComponent(req.query.email || '');
            
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }
            
            // Find active subscription with auto-payment enabled
            const subscription = await subscriptionsCollection.findOne({
                email: email,
                status: 'active',
                autoPayment: true
            });
            
            if (!subscription) {
                return res.status(200).json({ renewed: false, message: 'No active subscription with auto-payment' });
            }
            
            // Check if next payment date has passed
            const now = new Date();
            const nextPaymentDate = new Date(subscription.nextPaymentDate);
            
            if (now >= nextPaymentDate) {
                // Get user balance
                const user = await usersCollection.findOne({ email: email });
                const currentBalance = user?.balance || 0;
                
                if (currentBalance >= subscription.planPrice) {
                    // Deduct balance
                    const newBalance = currentBalance - subscription.planPrice;
                    await usersCollection.updateOne(
                        { email: email },
                        {
                            $set: {
                                balance: newBalance,
                                updatedAt: new Date()
                            }
                        }
                    );
                    
                    // Update subscription next payment date (30 days from now)
                    const newNextPaymentDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
                    await subscriptionsCollection.updateOne(
                        { _id: subscription._id },
                        {
                            $set: {
                                nextPaymentDate: newNextPaymentDate,
                                updatedAt: new Date()
                            }
                        }
                    );
                    
                    // Save transaction
                    const transactionsCollection = db.collection('transactions');
                    await transactionsCollection.insertOne({
                        email: email,
                        type: 'subscription_renewal',
                        amount: subscription.planPrice,
                        status: 'completed',
                        description: `Gia hạn tự động gói Robux ${subscription.planPrice}₫/tháng`,
                        createdAt: new Date()
                    });
                    
                    return res.status(200).json({
                        renewed: true,
                        amount: subscription.planPrice,
                        newBalance: newBalance,
                        nextPaymentDate: newNextPaymentDate
                    });
                } else {
                    // Insufficient balance - deactivate subscription
                    await subscriptionsCollection.updateOne(
                        { _id: subscription._id },
                        {
                            $set: {
                                status: 'inactive',
                                updatedAt: new Date()
                            }
                        }
                    );
                    
                    return res.status(200).json({
                        renewed: false,
                        message: 'Insufficient balance, subscription deactivated'
                    });
                }
            } else {
                return res.status(200).json({
                    renewed: false,
                    message: 'Next payment date not reached yet',
                    nextPaymentDate: nextPaymentDate
                });
            }
        } catch (error) {
            console.error('Error checking renewal:', error);
            res.status(500).json({ error: 'Failed to check renewal' });
        } finally {
            await client.close();
        }
    } else if (req.method === 'POST') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const subscriptionsCollection = db.collection('subscriptions');
            const usersCollection = db.collection('users');
            
            const { email, planPrice, autoPayment, startDate, nextPaymentDate } = req.body;
            
            if (!email || !planPrice) {
                return res.status(400).json({ error: 'Email and planPrice are required' });
            }
            
            // Check if user already has an active subscription
            const existingSubscription = await subscriptionsCollection.findOne({
                email: email,
                status: 'active'
            });
            
            if (existingSubscription) {
                return res.status(400).json({ error: 'User already has an active subscription' });
            }
            
            // Create subscription
            const subscription = {
                email: email,
                planPrice: planPrice,
                autoPayment: autoPayment || false,
                status: 'active',
                startDate: new Date(startDate),
                nextPaymentDate: new Date(nextPaymentDate),
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const result = await subscriptionsCollection.insertOne(subscription);
            
            res.status(200).json({ success: true, subscription: subscription });
        } catch (error) {
            console.error('Error creating subscription:', error);
            res.status(500).json({ error: 'Failed to create subscription' });
        } finally {
            await client.close();
        }
    } else if (req.method === 'GET') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const subscriptionsCollection = db.collection('subscriptions');
            
            const email = decodeURIComponent(req.query.email || '');
            
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }
            
            const subscription = await subscriptionsCollection.findOne({
                email: email,
                status: 'active'
            });
            
            res.status(200).json({ subscription: subscription || null });
        } catch (error) {
            console.error('Error getting subscription:', error);
            res.status(500).json({ error: 'Failed to get subscription' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['POST', 'GET']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

