const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors()); // Mengizinkan request dari frontend html

const PORT = 3000;
const RATE_PER_DAY = 500;

// Tambahkan baris ini agar Express bisa menampilkan file index.html di root
const path = require('path');
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// Database sementara di memori (Ganti dengan MySQL/MongoDB di produksi)
let databaseOrder = {};

// Fungsi generator API Key
function generateApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `arulzxd-${result}`;
}

/**
 * 1. ENDPOINT: MEMBUAT ORDER BARU
 */
app.post('/api/create-order', (req, res) => {
    const { username, duration } = req.body;
    
    if (!username || !duration) {
        return res.status(400).json({ success: false, message: 'Data tidak lengkap' });
    }

    // Rumus Matematika Tarif Paket: 500 * jumlah hari
    const totalPrice = duration * RATE_PER_DAY;

    // Simpan data order sementara dengan status belum dibayar (false)
    databaseOrder[username] = {
        duration: duration,
        total_price: totalPrice,
        paid: false,
        apiKey: null
    };

    console.log(`[ORDER] ${username} memesan premium untuk ${duration} hari. Total: Rp ${totalPrice}`);

    res.json({
        success: true,
        total_price: totalPrice
    });
});

/**
 * 2. ENDPOINT CALLBACK/WEBHOOK (DIPANGGIL OTOMATIS OLEH DANA BISNIS)
 * Daftarkan URL ini pada Dashboard Merchant DANA kamu.
 */
app.post('/dana-callback', (req, res) => {
    const paymentData = req.body;

    // Catatan: Payload DANA biasanya berisi detail nominal transaksi dan data merchant Anda.
    // Lakukan pencocokan nominal/ID jika diperlukan sesuai dokumentasi API DANA Bisnis Anda.
    
    if (paymentData.status === 'SUCCESS' || paymentData.transactionStatus === 'SUCCESS') {
        
        // Cari user yang sesuai (contoh pencocokan berdasarkan ekosistem pesanan kamu)
        // Di sini dicontohkan kita mengambil order terbaru yang nominalnya cocok
        const targetUsername = Object.keys(databaseOrder).find(
            key => databaseOrder[key].total_price === parseInt(paymentData.amount) && !databaseOrder[key].paid
        );

        if (targetUsername) {
            const apiKeyGenerated = generateApiKey();
            
            // Perbarui data menjadi sukses aktif
            databaseOrder[targetUsername].paid = true;
            databaseOrder[targetUsername].apiKey = apiKeyGenerated;

            console.log(`[WEBHOOK SUKSES] Pembayaran Rp ${paymentData.amount} Valid! API Key aktif untuk ${targetUsername}`);
            return res.status(200).json({ status: "SUCCESS" });
        }
    }

    res.status(400).json({ status: "FAILED" });
});

/**
 * 3. ENDPOINT CEK STATUS (POLING DARI FRONTEND)
 */
app.get('/api/check-status', (req, res) => {
    const { username } = req.query;
    const order = databaseOrder[username];

    if (order && order.paid) {
        res.json({ paid: true, apiKey: order.apiKey });
    } else {
        res.json({ paid: false });
    }
});

app.listen(PORT, () => {
    console.log(`Server Backend ArulzXD berjalan di http://localhost:${PORT}`);
});
