require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

async function getPrices() {
  try {
    // 1) Kripto dari CoinGecko
    const cryptoResp = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price',
      { params: { ids: 'bitcoin,ethereum', vs_currencies: 'usd' } }
    );

    // 2) Harga emas (XAU) dari MetalpriceAPI → USD per Ounce
    const goldResp = await axios.get(
      'https://api.metalpriceapi.com/v1/latest',
      {
        params: {
          api_key: process.env.METAL_API_KEY,
          base: 'XAU',
          currencies: 'USD'
        }
      }
    );

    // 3) Kurs USD → IDR dari CurrencyFreaks
    const fxResp = await axios.get(
      'https://api.currencyfreaks.com/v2.0/rates/latest',
      {
        params: { apikey: process.env.CURRENCYFREAKS_KEY }
      }
    );

    const btcUsd = cryptoResp.data.bitcoin.usd;
    const ethUsd = cryptoResp.data.ethereum.usd;

    const usdPerOunce = goldResp.data.rates?.USD;
    const usdToIdr = parseFloat(fxResp.data.rates?.IDR);

    if (!usdPerOunce) throw new Error("Harga emas tidak tersedia");
    if (!usdToIdr) throw new Error("Kurs USD/IDR tidak tersedia");

    // Konversi: Ounce → Gram
    const ounceToGram = usdPerOunce / 31.1034768;

    return {
      btcUsd,
      ethUsd,
      usdPerOunce,
      usdPerGram: ounceToGram,
      usdToIdr
    };

  } catch (error) {
    console.error("Fetch error:", error.response?.data || error.message);
    return null;
  }
}

app.get('/', async (req, res) => {
  const data = await getPrices();
  if (!data) return res.send("Gagal mengambil data harga.");

  const { btcUsd, ethUsd, usdPerOunce, usdPerGram, usdToIdr } = data;

  const prices = {
    btc: { usd: btcUsd, idr: btcUsd * usdToIdr },
    eth: { usd: ethUsd, idr: ethUsd * usdToIdr },
    gold: {
      ounce_usd: usdPerOunce,
      gram_usd: usdPerGram,
      ounce_idr: usdPerOunce * usdToIdr,
      gram_idr: usdPerGram * usdToIdr
    }
  };

  res.render('index', { prices });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
