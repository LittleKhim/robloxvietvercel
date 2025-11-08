import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'crypto';

const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

// Admin emails - you can move this to environment variables
const ADMIN_EMAILS = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];

function isAdmin(email) {
    return ADMIN_EMAILS.includes(email);
}

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const marketplaceCollection = db.collection('marketplace');
            
            const { sellerEmail, category, verified, pending, page = 1, limit = 12, search } = req.query;
            
            // Build base query conditions
            const conditions = [];
            
            // Filter by seller
            if (sellerEmail) {
                conditions.push({ sellerEmail: decodeURIComponent(sellerEmail) });
            }
            
            // Filter by category
            if (category && category !== 'all') {
                conditions.push({ category: category });
            }
            
            // For regular users, only show verified items
            // For admins, can see all or filter by verified status
            if (pending === 'true') {
                conditions.push({ verified: false });
            } else if (verified !== undefined) {
                conditions.push({ verified: verified === 'true' });
            } else {
                // Default: only show verified items to non-admins
                conditions.push({ verified: true });
            }
            
            // Auto-delete items older than 72 hours (only for verified items in browse view)
            if (pending !== 'true' && verified !== 'false') {
                const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
                conditions.push({ createdAt: { $gte: seventyTwoHoursAgo } });
            }
            
            // Search by name or description
            if (search && search.trim()) {
                const searchRegex = { $regex: search.trim(), $options: 'i' };
                conditions.push({
                    $or: [
                        { name: searchRegex },
                        { description: searchRegex }
                    ]
                });
            }
            
            // Build final query
            let query = {};
            if (conditions.length === 1) {
                query = conditions[0];
            } else if (conditions.length > 1) {
                query = { $and: conditions };
            }
            
            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const skip = (pageNum - 1) * limitNum;
            
            // Get total count for pagination
            const total = await marketplaceCollection.countDocuments(query);
            
            const items = await marketplaceCollection
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .toArray();
            
            // Add time remaining for each item
            const itemsWithTimeRemaining = items.map(item => {
                const createdAt = new Date(item.createdAt);
                const expiresAt = new Date(createdAt.getTime() + 72 * 60 * 60 * 1000);
                const now = new Date();
                const timeRemaining = Math.max(0, expiresAt.getTime() - now.getTime());
                
                return {
                    ...item,
                    expiresAt: expiresAt.toISOString(),
                    timeRemaining: timeRemaining // milliseconds
                };
            });
            
            res.status(200).json({ 
                items: itemsWithTimeRemaining,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum)
                }
            });
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
            
            const { sellerEmail, name, description, image, price, quantity, category, phone, facebookLink } = req.body;
            
            if (!sellerEmail || !name || !price || !quantity) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            
            // Check user balance and deduct posting fee (2,000₫)
            const usersCollection = db.collection('users');
            const user = await usersCollection.findOne({ email: sellerEmail });
            
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            const postingFee = 2000;
            const currentBalance = user.balance || 0;
            
            if (currentBalance < postingFee) {
                return res.status(400).json({ 
                    error: `Số dư không đủ! Cần ${postingFee.toLocaleString('vi-VN')}₫ để đăng sản phẩm. Số dư hiện tại: ${currentBalance.toLocaleString('vi-VN')}₫`,
                    insufficientBalance: true
                });
            }
            
            // Deduct posting fee
            await usersCollection.updateOne(
                { email: sellerEmail },
                { 
                    $inc: { balance: -postingFee },
                    $set: { updatedAt: new Date() }
                }
            );
            
            // Generate unique UID for product
            const uid = 'MP-' + crypto.randomBytes(8).toString('hex').toUpperCase();
            
            // If admin, item is auto-verified. Otherwise, needs verification
            const verified = isAdmin(sellerEmail);
            
            // Calculate expiration time (72 hours from now)
            const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
            
            const item = {
                uid: uid,
                sellerEmail: sellerEmail,
                name: name,
                description: description || '',
                image: image || 'https://via.placeholder.com/200',
                price: parseFloat(price),
                quantity: parseInt(quantity),
                category: category || 'other', // Default category
                phone: phone || '',
                facebookLink: facebookLink || '',
                sold: 0,
                verified: verified,
                verifiedAt: verified ? new Date() : null,
                verifiedBy: verified ? sellerEmail : null,
                createdAt: new Date(),
                expiresAt: expiresAt,
                updatedAt: new Date()
            };
            
            const result = await marketplaceCollection.insertOne(item);
            
            // Log transaction for posting fee
            const transactionsCollection = db.collection('transactions');
            await transactionsCollection.insertOne({
                id: 'TXN-' + Date.now(),
                type: 'marketplace_fee',
                userEmail: sellerEmail,
                amount: -postingFee,
                status: 'completed',
                description: `Phí đăng sản phẩm: ${name}`,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            res.status(200).json({ 
                success: true, 
                item: { ...item, _id: result.insertedId },
                message: verified ? 'Sản phẩm đã được đăng (Admin)' : 'Sản phẩm đã được gửi, đang chờ admin duyệt',
                feeDeducted: postingFee,
                newBalance: currentBalance - postingFee
            });
        } catch (error) {
            console.error('Error creating marketplace item:', error);
            res.status(500).json({ error: 'Failed to create marketplace item' });
        } finally {
            await client.close();
        }
    } else if (req.method === 'PUT') {
        // Verify or update item (admin only for verify)
        const { id } = req.query;
        const { action, adminEmail, sellerEmail, name, description, image, price, quantity, category } = req.body;
        
        if (!id) {
            return res.status(400).json({ error: 'Item ID is required' });
        }
        
        try {
            await client.connect();
            const db = client.db('store_db');
            const marketplaceCollection = db.collection('marketplace');
            
            // Validate ObjectId format
            let objectId;
            try {
                objectId = new ObjectId(id);
            } catch (error) {
                return res.status(400).json({ error: 'Invalid item ID format' });
            }
            
            if (action === 'verify') {
                // Verify item (admin only)
                if (!adminEmail || !isAdmin(adminEmail)) {
                    return res.status(403).json({ error: 'Only admins can verify items' });
                }
                
                const result = await marketplaceCollection.updateOne(
                    { _id: objectId },
                    {
                        $set: {
                            verified: true,
                            verifiedAt: new Date(),
                            verifiedBy: adminEmail,
                            updatedAt: new Date()
                        }
                    }
                );
                
                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: 'Item not found' });
                }
                
                return res.status(200).json({ success: true, message: 'Item verified' });
            } else if (action === 'reject') {
                // Reject item (admin only)
                if (!adminEmail || !isAdmin(adminEmail)) {
                    return res.status(403).json({ error: 'Only admins can reject items' });
                }
                
                const result = await marketplaceCollection.deleteOne({ _id: objectId });
                
                if (result.deletedCount === 0) {
                    return res.status(404).json({ error: 'Item not found' });
                }
                
                return res.status(200).json({ success: true, message: 'Item rejected and deleted' });
            }
        } else {
            // Update item (seller or admin)
            try {
                await client.connect();
                const db = client.db('store_db');
                const marketplaceCollection = db.collection('marketplace');
                
                // Check if user owns the item or is admin
                const item = await marketplaceCollection.findOne({ _id: new ObjectId(id) });
                if (!item) {
                    return res.status(404).json({ error: 'Item not found' });
                }
                
                if (item.sellerEmail !== sellerEmail && !isAdmin(sellerEmail)) {
                    return res.status(403).json({ error: 'You can only update your own items' });
                }
                
                const updateData = {
                    updatedAt: new Date()
                };
                
                if (name) updateData.name = name;
                if (description !== undefined) updateData.description = description;
                if (image) updateData.image = image;
                if (price) updateData.price = parseFloat(price);
                if (quantity) updateData.quantity = parseInt(quantity);
                if (category && ['robux', 'item', 'other'].includes(category)) {
                    updateData.category = category;
                }
                
                // If item was not verified and admin is updating, auto-verify
                if (!item.verified && isAdmin(sellerEmail)) {
                    updateData.verified = true;
                    updateData.verifiedAt = new Date();
                    updateData.verifiedBy = sellerEmail;
                }
                
                const result = await marketplaceCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );
                
                res.status(200).json({ success: true, message: 'Item updated' });
            } catch (error) {
                console.error('Error updating item:', error);
                res.status(500).json({ error: 'Failed to update item' });
            } finally {
                await client.close();
            }
        }
    } else if (req.method === 'DELETE') {
        // Delete item (seller or admin)
        const { id } = req.query;
        const { sellerEmail } = req.body;
        
        if (!id) {
            return res.status(400).json({ error: 'Item ID is required' });
        }
        
        try {
            await client.connect();
            const db = client.db('store_db');
            const marketplaceCollection = db.collection('marketplace');
            
            // Check if user owns the item or is admin
            const item = await marketplaceCollection.findOne({ _id: new ObjectId(id) });
            if (!item) {
                return res.status(404).json({ error: 'Item not found' });
            }
            
            if (item.sellerEmail !== sellerEmail && !isAdmin(sellerEmail)) {
                return res.status(403).json({ error: 'You can only delete your own items' });
            }
            
            const result = await marketplaceCollection.deleteOne({ _id: new ObjectId(id) });
            
            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Item not found' });
            }
            
            res.status(200).json({ success: true, message: 'Item deleted' });
        } catch (error) {
            console.error('Error deleting item:', error);
            res.status(500).json({ error: 'Failed to delete item' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}
