import { MongoClient } from 'mongodb';
import crypto from 'crypto';

const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

// Hash password
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return salt + ':' + hash;
}

// Verify password
function verifyPassword(password, hashedPassword) {
    const [salt, hash] = hashedPassword.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}

export default async function handler(req, res) {
    const { action } = req.query;
    
    try {
        await client.connect();
        const db = client.db('store_db');
        const usersCollection = db.collection('users');
        const blacklistCollection = db.collection('blacklist');
        
        // REGISTER - POST /api/auth?action=register or POST /api/auth (default)
        if (req.method === 'POST' && (!action || action === 'register')) {
            const { email, password, name } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
            }
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'Email không hợp lệ' });
            }
            
            // Validate password length
            if (password.length < 6) {
                return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự' });
            }
            
            // Check if user already exists
            const existingUser = await usersCollection.findOne({ email: email.toLowerCase().trim() });
            if (existingUser) {
                return res.status(400).json({ error: 'Email này đã được sử dụng' });
            }
            
            // Hash password
            const hashedPassword = hashPassword(password);
            
            // Create user
            const userData = {
                email: email.toLowerCase().trim(),
                name: name || email.split('@')[0],
                password: hashedPassword,
                balance: 0,
                authMethod: 'email',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const result = await usersCollection.insertOne(userData);
            
            // Don't send password back
            delete userData.password;
            
            return res.status(200).json({ 
                success: true, 
                message: 'Đăng ký thành công!',
                user: userData
            });
        }
        
        // LOGIN - POST /api/auth?action=login
        if (req.method === 'POST' && action === 'login') {
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
            
            return res.status(200).json({ 
                success: true,
                message: 'Đăng nhập thành công!',
                user: userResponse
            });
        }
        
        // CHANGE PASSWORD - PUT /api/auth?action=change-password
        if (req.method === 'PUT' && action === 'change-password') {
            const { email, currentPassword, newPassword } = req.body;
            
            if (!email || !currentPassword || !newPassword) {
                return res.status(400).json({ error: 'Email, mật khẩu hiện tại và mật khẩu mới là bắt buộc' });
            }
            
            // Validate new password length
            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
            }
            
            // Find user
            const user = await usersCollection.findOne({ email: email.toLowerCase().trim() });
            
            if (!user) {
                return res.status(404).json({ error: 'Người dùng không tồn tại' });
            }
            
            // Check if user has password (email auth)
            if (!user.password) {
                return res.status(400).json({ 
                    error: 'Tài khoản này không có mật khẩu. Vui lòng đặt mật khẩu mới.',
                    canSetPassword: true
                });
            }
            
            // Verify current password
            if (!verifyPassword(currentPassword, user.password)) {
                return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng' });
            }
            
            // Hash new password
            const hashedPassword = hashPassword(newPassword);
            
            // Update password
            await usersCollection.updateOne(
                { email: user.email },
                { 
                    $set: { 
                        password: hashedPassword,
                        updatedAt: new Date()
                    } 
                }
            );
            
            return res.status(200).json({ 
                success: true,
                message: 'Đổi mật khẩu thành công!'
            });
        }
        
        // SET PASSWORD (for Google users) - POST /api/auth?action=set-password
        if (req.method === 'POST' && action === 'set-password') {
            const { email, newPassword } = req.body;
            
            if (!email || !newPassword) {
                return res.status(400).json({ error: 'Email và mật khẩu mới là bắt buộc' });
            }
            
            // Validate new password length
            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
            }
            
            // Find user
            const user = await usersCollection.findOne({ email: email.toLowerCase().trim() });
            
            if (!user) {
                return res.status(404).json({ error: 'Người dùng không tồn tại' });
            }
            
            // Hash new password
            const hashedPassword = hashPassword(newPassword);
            
            // Update password
            await usersCollection.updateOne(
                { email: user.email },
                { 
                    $set: { 
                        password: hashedPassword,
                        authMethod: 'both',
                        updatedAt: new Date()
                    } 
                }
            );
            
            return res.status(200).json({ 
                success: true,
                message: 'Đặt mật khẩu thành công!'
            });
        }
        
        // Method not allowed
        res.setHeader('Allow', ['POST', 'PUT']);
        res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Auth API error:', error);
        res.status(500).json({ error: 'Lỗi server. Vui lòng thử lại.' });
    } finally {
        await client.close();
    }
}

