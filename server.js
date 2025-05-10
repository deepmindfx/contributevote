const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Flutterwave credentials from .env
const FLW_PUBLIC_KEY = process.env.FLUTTERWAVE_PUBLIC_KEY;
const FLW_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

app.get('/api/banks', async (req, res) => {
  try {
    const response = await axios.get('https://api.flutterwave.com/v3/banks/NG', {
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
      },
    });
    res.json({ status: 'success', data: response.data.data });
  } catch (error) {
    console.error('Banks fetch error:', error.response?.data || error.message);
    res.status(500).json({ message: error.response?.data?.message || error.message || 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 