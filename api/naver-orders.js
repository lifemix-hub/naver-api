const bcrypt = require('bcryptjs');
const axios = require('axios');

module.exports = async function handler(req, res) {
  const CLIENT_ID = process.env.NAVER_CLIENT_ID;
  const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
  const ACCOUNT_ID = process.env.NAVER_ACCOUNT_ID;

  try {
    const timestamp = String(Date.now());
    const password = `${CLIENT_ID}_${timestamp}`;
    const hashed = bcrypt.hashSync(password, CLIENT_SECRET);
    const client_secret_sign = Buffer.from(hashed).toString('base64');

    const tokenResponse = await axios.post(
      'https://api.commerce.naver.com/external/v1/oauth2/token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        timestamp,
        client_secret_sign,
        grant_type: 'client_credentials',
        type: 'SELLER',
        account_id: ACCOUNT_ID
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');

    const fromDate = `${yyyy}-${mm}-${dd}T00:00:00.000+09:00`;
    const toDate = `${yyyy}-${mm}-${dd}T23:59:59.999+09:00`;

    const orderResponse = await axios.get(
      'https://api.commerce.naver.com/external/v1/pay-order/seller/product-orders',
      {
        params: {
          from: fromDate,
          to: toDate,
          page: 1,
          pageSize: 300
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const rows = orderResponse.data?.data || [];
    const orders = rows.map(row => row.order || row);

    const totalPaymentAmount = orders.reduce((sum, order) => {
      return sum + (Number(order.totalPaymentAmount) || 0);
    }, 0);

    res.status(200).json({
      from: fromDate,
      to: toDate,
      totalPaymentAmount,
      orderCount: orders.length,
      orders
    });
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('Error Detail:', detail);
    res.status(500).json({ error: '인증 또는 조회 실패', detail });
  }
};
