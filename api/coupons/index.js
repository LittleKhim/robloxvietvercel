import { MongoClient } from 'mongodb';

const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

export default async function handler(req, res) {
    // Handle coupon check (GET with code query param or action=check)
    if (req.method === 'GET' && (req.query.code || req.query.action === 'check')) {
        try {
            await client.connect();
            const db = client.db('store_db');
            const couponsCollection = db.collection('coupons');
            
            const code = req.query.code?.toUpperCase().trim();
            
            if (!code) {
                return res.status(400).json({ valid: false, message: 'Mã giảm giá không được để trống' });
            }
            
            const coupon = await couponsCollection.findOne({ code: code });
            
            if (!coupon) {
                return res.status(200).json({ valid: false, message: 'Mã giảm giá không tồn tại' });
            }
            
            // Check if coupon is active
            if (!coupon.active) {
                return res.status(200).json({ valid: false, message: 'Mã giảm giá đã bị vô hiệu hóa' });
            }
            
            // Check expiration date
            if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
                return res.status(200).json({ valid: false, message: 'Mã giảm giá đã hết hạn' });
            }
            
            // Check usage limit
            if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
                return res.status(200).json({ valid: false, message: 'Mã giảm giá đã hết lượt sử dụng' });
            }
            
            return res.status(200).json({ 
                valid: true, 
                coupon: {
                    code: coupon.code,
                    discountType: coupon.discountType,
                    discountValue: coupon.discountValue,
                    description: coupon.description
                }
            });
        } catch (error) {
            console.error('Error checking coupon:', error);
            res.status(500).json({ valid: false, message: 'Lỗi kiểm tra mã giảm giá' });
        } finally {
            await client.close();
        }
        return;
    }
    
    // Handle coupon usage logging (POST with action=use)
    if (req.method === 'POST' && req.query.action === 'use') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const logsCollection = db.collection('coupon_logs');
            
            const { code, email, amount, originalAmount, discount, type, quantity } = req.body;
            
            // Log the coupon usage (will be marked as completed when purchase is confirmed)
            const log = {
                couponCode: code.toUpperCase().trim(),
                email: email,
                amount: amount,
                originalAmount: originalAmount,
                discount: discount,
                type: type, // 'robux' or 'subscription'
                quantity: quantity || null,
                status: 'pending', // Will be updated to 'completed' when order is confirmed
                createdAt: new Date()
            };
            
            await logsCollection.insertOne(log);
            
            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error logging coupon usage:', error);
            res.status(500).json({ error: 'Failed to log coupon usage' });
        } finally {
            await client.close();
        }
        return;
    }
    
    if (req.method === 'GET') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const couponsCollection = db.collection('coupons');
            
            const coupons = await couponsCollection.find({}).sort({ createdAt: -1 }).toArray();
            
            // Get usage stats for each coupon
            const logsCollection = db.collection('coupon_logs');
            for (let coupon of coupons) {
                const successfulUses = await logsCollection.countDocuments({ 
                    couponCode: coupon.code,
                    status: 'completed'
                });
                coupon.successfulUses = successfulUses;
            }
            
            res.status(200).json({ coupons });
        } catch (error) {
            console.error('Error getting coupons:', error);
            res.status(500).json({ error: 'Failed to get coupons' });
        } finally {
            await client.close();
        }
    } else if (req.method === 'POST') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const couponsCollection = db.collection('coupons');
            
            const { code, discountType, discountValue, description, maxUses, expiresAt } = req.body;
            
            if (!code || !discountType || discountValue === undefined) {
                return res.status(400).json({ error: 'Code, discountType, and discountValue are required' });
            }
            
            const coupon = {
                code: code.toUpperCase().trim(),
                discountType: discountType, // 'percentage' or 'fixed'
                discountValue: parseFloat(discountValue),
                description: description || '',
                maxUses: maxUses ? parseInt(maxUses) : null,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                active: true,
                usedCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Check if code already exists
            const existing = await couponsCollection.findOne({ code: coupon.code });
            if (existing) {
                return res.status(400).json({ error: 'Mã giảm giá đã tồn tại' });
            }
            
            const result = await couponsCollection.insertOne(coupon);
            res.status(200).json({ success: true, coupon });
        } catch (error) {
            console.error('Error creating coupon:', error);
            res.status(500).json({ error: 'Failed to create coupon' });
        } finally {
            await client.close();
        }
    } else if (req.method === 'DELETE') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const couponsCollection = db.collection('coupons');
            
            const { code } = req.query;
            
            if (!code) {
                return res.status(400).json({ error: 'Code is required' });
            }
            
            const result = await couponsCollection.deleteOne({ code: code.toUpperCase().trim() });
            
            if (result.deletedCount === 0) {
                return res.status(404).json({ error: 'Coupon not found' });
            }
            
            res.status(200).json({ success: true });
        } catch (error) {
            console.error('Error deleting coupon:', error);
            res.status(500).json({ error: 'Failed to delete coupon' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

