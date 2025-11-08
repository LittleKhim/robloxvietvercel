# MongoDB Atlas Setup với Vercel

## Đã tạo các API Routes

### 1. Users API
- **`/api/users/index.js`** - Tạo/cập nhật user
- **`/api/users/[email]/balance.js`** - Lấy và cập nhật số dư theo email

### 2. Transactions API
- **`/api/transactions/index.js`** - Lưu và lấy giao dịch
- **`/api/transactions/[id].js`** - Cập nhật trạng thái giao dịch (pending/completed/cancelled)

### 3. Orders API
- **`/api/orders/index.js`** - Lưu và lấy đơn hàng
- **`/api/orders/[id].js`** - Cập nhật trạng thái đơn hàng

## Cấu trúc Database

### Collection: `users`
```javascript
{
  email: "user@example.com",
  name: "User Name",
  balance: 100000,
  createdAt: ISODate,
  updatedAt: ISODate
}
```

### Collection: `transactions`
```javascript
{
  id: "TXN-1234567890",
  type: "topup",
  amount: 100000,
  status: "pending", // pending, completed, cancelled
  userEmail: "user@example.com",
  userName: "User Name",
  description: "Nạp tiền 100.000 ₫",
  createdAt: ISODate,
  updatedAt: ISODate,
  completedAt: ISODate, // nếu completed
  cancelledAt: ISODate  // nếu cancelled
}
```

### Collection: `orders`
```javascript
{
  code: "ORD-1234567890-1234",
  userEmail: "user@example.com",
  userName: "User Name",
  items: [
    {
      name: "Robux",
      price: 12500,
      quantity: 1,
      robuxAmount: 100
    }
  ],
  total: 12500,
  status: "pending", // pending, paid, cancelled
  createdAt: ISODate,
  updatedAt: ISODate
}
```

## Environment Variables trong Vercel

1. Vào Vercel Dashboard → Project Settings → Environment Variables
2. Thêm biến:
   - **`STORAGE_URL`** hoặc **`MONGODB_URI`**: Connection string từ MongoDB Atlas
     - Format: `mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority`

## Cách lấy MongoDB Connection String

1. Đăng nhập MongoDB Atlas
2. Vào **Database** → **Connect**
3. Chọn **Connect your application**
4. Copy connection string
5. Thay `<password>` bằng password của bạn
6. Thêm vào Vercel Environment Variables

## Database Name

Tất cả API routes sử dụng database name: **`store_db`**

Nếu muốn đổi, sửa trong các file API:
```javascript
const db = client.db('store_db'); // Đổi tên database ở đây
```

## Deploy

1. Push code lên GitHub
2. Vercel sẽ tự động deploy
3. Đảm bảo Environment Variables đã được set
4. Test các API endpoints

## API Endpoints

### Users
- `GET /api/users/[email]/balance` - Lấy số dư
- `PUT /api/users/[email]/balance` - Cập nhật số dư
- `POST /api/users` - Tạo/cập nhật user

### Transactions
- `POST /api/transactions` - Lưu giao dịch
- `GET /api/transactions?userEmail=...` - Lấy giao dịch
- `PUT /api/transactions/[id]` - Cập nhật trạng thái

### Orders
- `POST /api/orders` - Lưu đơn hàng
- `GET /api/orders?userEmail=...&status=...` - Lấy đơn hàng
- `PUT /api/orders/[id]` - Cập nhật trạng thái

## Lưu ý

- Tất cả dữ liệu được lưu theo **email** làm key
- Số dư được quản lý trên server để tránh hack qua F12
- Giao dịch và đơn hàng được lưu với đầy đủ thông tin user
- LocalStorage vẫn được dùng làm cache/backup

