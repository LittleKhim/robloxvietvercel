import { MongoClient, ObjectId } from 'mongodb';

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
            
            const { sellerEmail, category, verified, pending, page = 1, limit = 12 } = req.query;
            
            let query = {};
            
            // Filter by seller
            if (sellerEmail) {
                query.sellerEmail = decodeURIComponent(sellerEmail);
            }
            
            // Filter by category
            if (category && category !== 'all') {
                query.category = category;
            }
            
            // For regular users, only show verified items
            // For admins, can see all or filter by verified status
            if (pending === 'true') {
                query.verified = false;
            } else if (verified !== undefined) {
                query.verified = verified === 'true';
            } else {
                // Default: only show verified items to non-admins
                query.verified = true;
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
            
            res.status(200).json({ 
                items,
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
            
            // If admin, item is auto-verified. Otherwise, needs verification
            const verified = isAdmin(sellerEmail);
            
            const item = {
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
                updatedAt: new Date()
            };
            
            const result = await marketplaceCollection.insertOne(item);
            res.status(200).json({ 
                success: true, 
                item: { ...item, _id: result.insertedId },
                message: verified ? 'Sản phẩm đã được đăng (Admin)' : 'Sản phẩm đã được gửi, đang chờ admin duyệt'
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
        
        if (action === 'verify') {
            // Verify item (admin only)
            if (!adminEmail || !isAdmin(adminEmail)) {
                return res.status(403).json({ error: 'Only admins can verify items' });
            }
            
            try {
                await client.connect();
                const db = client.db('store_db');
                const marketplaceCollection = db.collection('marketplace');
                
                const result = await marketplaceCollection.updateOne(
                    { _id: new ObjectId(id) },
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
                
                res.status(200).json({ success: true, message: 'Item verified' });
            } catch (error) {
                console.error('Error verifying item:', error);
                res.status(500).json({ error: 'Failed to verify item' });
            } finally {
                await client.close();
            }
        } else if (action === 'reject') {
            // Reject item (admin only)
            if (!adminEmail || !isAdmin(adminEmail)) {
                return res.status(403).json({ error: 'Only admins can reject items' });
            }
            
            try {
                await client.connect();
                const db = client.db('store_db');
                const marketplaceCollection = db.collection('marketplace');
                
                const result = await marketplaceCollection.deleteOne({ _id: new ObjectId(id) });
                
                if (result.deletedCount === 0) {
                    return res.status(404).json({ error: 'Item not found' });
                }
                
                res.status(200).json({ success: true, message: 'Item rejected and deleted' });
            } catch (error) {
                console.error('Error rejecting item:', error);
                res.status(500).json({ error: 'Failed to reject item' });
            } finally {
                await client.close();
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
