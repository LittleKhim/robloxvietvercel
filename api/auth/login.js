import { MongoClient } from 'mongodb';
import crypto from 'crypto';

const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

// Verify password
function verifyPassword(password, hashedPassword) {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const usersCollection = db.collection('users');
            
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
            }
            
            // Find user
            const user = await usersCollection.findOne({ email: email.toLowerCase().trim() });
            
            if (!user) {
                return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
            }
            
            // Check if user has password (email auth) or only Google auth
            if (!user.password) {
                return res.status(401).json({ 
                    error: 'Tài khoản này chỉ có thể đăng nhập bằng Google',
                    useGoogle: true
                });
            }
            
            // Verify password
            if (!verifyPassword(password, user.password)) {
                return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
            }
            
            // Check if user is blacklisted
            const blacklistCollection = db.collection('blacklist');
            const isBlacklisted = await blacklistCollection.findOne({ email: user.email });
            if (isBlacklisted) {
                return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa' });
            }
            
            // Update last login
            await usersCollection.updateOne(
                { email: user.email },
                { $set: { lastLogin: new Date(), updatedAt: new Date() } }
            );
            
            // Don't send password back
            const userResponse = {
                email: user.email,
                name: user.name || user.email,
                balance: user.balance || 0,
                authMethod: user.authMethod || 'email',
                createdAt: user.createdAt,
                lastLogin: new Date()
            };
            
            res.status(200).json({ 
                success: true,
                message: 'Đăng nhập thành công!',
                user: userResponse
            });
        } catch (error) {
            console.error('Error logging in:', error);
            res.status(500).json({ error: 'Lỗi đăng nhập. Vui lòng thử lại.' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

