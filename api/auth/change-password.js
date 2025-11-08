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
    if (req.method === 'PUT') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const usersCollection = db.collection('users');
            
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
            
            res.status(200).json({ 
                success: true,
                message: 'Đổi mật khẩu thành công!'
            });
        } catch (error) {
            console.error('Error changing password:', error);
            res.status(500).json({ error: 'Lỗi đổi mật khẩu. Vui lòng thử lại.' });
        } finally {
            await client.close();
        }
    } else if (req.method === 'POST') {
        // Set password for Google users
        try {
            await client.connect();
            const db = client.db('store_db');
            const usersCollection = db.collection('users');
            
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
                        authMethod: 'both', // Can use both email and Google
                        updatedAt: new Date()
                    } 
                }
            );
            
            res.status(200).json({ 
                success: true,
                message: 'Đặt mật khẩu thành công!'
            });
        } catch (error) {
            console.error('Error setting password:', error);
            res.status(500).json({ error: 'Lỗi đặt mật khẩu. Vui lòng thử lại.' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['PUT', 'POST']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

