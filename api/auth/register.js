import { MongoClient } from 'mongodb';
import crypto from 'crypto';

const uri = process.env.STORAGE_URL || process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-lazydata:0xyodbn9xOEDyhLo@lazydata.1zrhuoo.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri);

// Simple password hashing function (using crypto built-in)
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return salt + ':' + hash;
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            await client.connect();
            const db = client.db('store_db');
            const usersCollection = db.collection('users');
            
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
                authMethod: 'email', // 'email' or 'google'
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const result = await usersCollection.insertOne(userData);
            
            // Don't send password back
            delete userData.password;
            
            res.status(200).json({ 
                success: true, 
                message: 'Đăng ký thành công!',
                user: userData
            });
        } catch (error) {
            console.error('Error registering user:', error);
            res.status(500).json({ error: 'Lỗi đăng ký. Vui lòng thử lại.' });
        } finally {
            await client.close();
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}

