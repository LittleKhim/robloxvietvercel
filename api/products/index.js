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
            const productsCollection = db.collection('products');
            
            const { category, sellerEmail, verified, pending } = req.query;
            
            let query = {};
            
            // Filter by category (all, robux, item, other)
            if (category && category !== 'all') {
                query.category = category;
            }
            
            // Filter by seller
            if (sellerEmail) {
                query.sellerEmail = decodeURIComponent(sellerEmail);
            }
            
            // For regular users, only show verified products
            // For admins, can see all or filter by verified status
            if (pending === 'true') {
                query.verified = false;
            } else if (verified !== undefined) {
                query.verified = verified === 'true';
            } else {
                // Default: only show verified products to non-admins
                query.verified = true;
            }
            
            const products = await productsCollection.find(query).sort({ createdAt: -1 }).toArray();
            
            res.status(200).json({ products });
        } catch (error) {
            console.error('Error getting products:', error);
            res.status(500).json({ error: 'Failed to get products' });
        } finally {
            await client.close();
        }
    } else if (req.method === 'POST') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const productsCollection = db.collection('products');
            
            const { sellerEmail, name, description, image, price, quantity, category } = req.body;
            
            if (!sellerEmail || !name || !price || !quantity || !category) {
                return res.status(400).json({ error: 'Missing required fields' });
            }
            
            // Validate category
            const validCategories = ['robux', 'item', 'other'];
            if (!validCategories.includes(category)) {
                return res.status(400).json({ error: 'Invalid category. Must be: robux, item, or other' });
            }
            
            // If admin, product is auto-verified. Otherwise, needs verification
            const verified = isAdmin(sellerEmail);
            
            const product = {
                sellerEmail: sellerEmail,
                name: name,
                description: description || '',
                image: image || 'https://via.placeholder.com/200',
                price: parseFloat(price),
                quantity: parseInt(quantity),
                category: category,
                sold: 0,
                verified: verified,
                verifiedAt: verified ? new Date() : null,
                verifiedBy: verified ? sellerEmail : null,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const result = await productsCollection.insertOne(product);
            res.status(200).json({ 
                success: true, 
                product: { ...product, _id: result.insertedId },
                message: verified ? 'Sản phẩm đã được đăng (Admin)' : 'Sản phẩm đã được gửi, đang chờ admin duyệt'
            });
        } catch (error) {
            console.error('Error creating product:', error);
            res.status(500).json({ error: 'Failed to create product' });
        } finally {
            await client.close();
        }
    } else if (req.method === 'PUT') {
        // Verify or update product (admin only)
        const { id } = req.query;
        const { action, adminEmail } = req.body;
        
        if (!id) {
            return res.status(400).json({ error: 'Product ID is required' });
        }
        
        if (action === 'verify') {
            // Verify product (admin only)
            if (!adminEmail || !isAdmin(adminEmail)) {
                return res.status(403).json({ error: 'Only admins can verify products' });
            }
            
            try {
                await client.connect();
                const db = client.db('store_db');
                const productsCollection = db.collection('products');
                
                const result = await productsCollection.updateOne(
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
                    return res.status(404).json({ error: 'Product not found' });
                }
                
                res.status(200).json({ success: true, message: 'Product verified' });
            } catch (error) {
                console.error('Error verifying product:', error);
                res.status(500).json({ error: 'Failed to verify product' });
            } finally {
                await client.close();
            }
        } else if (action === 'reject') {
            // Reject product (admin only)
            if (!adminEmail || !isAdmin(adminEmail)) {
                return res.status(403).json({ error: 'Only admins can reject products' });
            }
            
            try {
                await client.connect();
                const db = client.db('store_db');
                const productsCollection = db.collection('products');
                
                const result = await productsCollection.deleteOne({ _id: new ObjectId(id) });
                
                if (result.deletedCount === 0) {
                    return res.status(404).json({ error: 'Product not found' });
                }
                
                res.status(200).json({ success: true, message: 'Product rejected and deleted' });
            } catch (error) {
                console.error('Error rejecting product:', error);
                res.status(500).json({ error: 'Failed to reject product' });
            } finally {
                await client.close();
            }
        } else {
            // Update product (seller or admin)
            try {
                await client.connect();
                const db = client.db('store_db');
                const productsCollection = db.collection('products');
                
                // Check if user owns the product or is admin
                const product = await productsCollection.findOne({ _id: new ObjectId(id) });
                if (!product) {
                    return res.status(404).json({ error: 'Product not found' });
                }
                
                const { sellerEmail, name, description, image, price, quantity, category } = req.body;
                
                if (product.sellerEmail !== sellerEmail && !isAdmin(sellerEmail)) {
                    return res.status(403).json({ error: 'You can only update your own products' });
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
                
                // If product was not verified and admin is updating, auto-verify
                if (!product.verified && isAdmin(sellerEmail)) {
                    updateData.verified = true;
                    updateData.verifiedAt = new Date();
                    updateData.verifiedBy = sellerEmail;
                }
                
                const result = await productsCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updateData }
                );
                
                res.status(200).json({ success: true, message: 'Product updated' });
            } catch (error) {
                console.error('Error updating product:', error);
                res.status(500).json({ error: 'Failed to update product' });
            } finally {
                await client.close();
            }
        }
    } else if (req.method === 'DELETE') {
        // Delete product (seller or admin)
        const { id } = req.query;
        const { sellerEmail } = req.body;
        
        if (!id) {
            return res.status(400).json({ error: 'Product ID is required' });
        }
        
        try {
            await client.connect();
            const db = client.db('store_db');
            const productsCollection = db.collection('products');
            
            // Check if user owns the product or is admin
            const product = await productsCollection.findOne({ _id: new ObjectId(id) });
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }
            
            if (product.sellerEmail !== sellerEmail && !isAdmin(sellerEmail)) {
                return res.status(403).json({ error: 'You can only delete your own products' });
            }
            
            const result = await productsCollection.deleteOne({ _id: new ObjectId(id) });
            
            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Product not found' });
            }
            
            res.status(200).json({ success: true, message: 'Product deleted' });
        } catch (error) {
            console.error('Error deleting product:', error);
            res.status(500).json({ error: 'Failed to delete product' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

