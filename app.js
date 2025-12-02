require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));

// Cache data
let cachedData = {
  prices: {
    gold: { gram_usd: 62.71, gram_idr: 972000, change: 0.25 },
    silver: { gram_usd: 0.753, gram_idr: 11680, change: -0.12 },
    oil: { usd: 78.30, idr: 1213000, change: 0.87 }
  },
  usd_to_idr: 15500,
  lastUpdate: new Date()
};

// Simpan harga sebelumnya
let previousPrices = {
  gold: { gram_usd: 62.71 },
  silver: { gram_usd: 0.753 },
  oil: { usd: 78.30 }
};

// 1. API KURS USD/IDR
async function getExchangeRate() {
  try {
    const response = await axios.get('https://api.frankfurter.app/latest', {
      params: { from: 'USD', to: 'IDR' },
      timeout: 3000
    });
    
    if (response.data?.rates?.IDR) {
      return response.data.rates.IDR;
    }
  } catch (error) {
    console.log("⚠️ Frankfurter gagal");
  }

  try {
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', {
      timeout: 3000
    });
    return response.data.rates.IDR || 15500;
  } catch (error) {
    console.log("⚠️ ExchangeRate-API gagal, pakai default 15500");
    return 15500;
  }
}

// 2. COMMODITY PRICE API v2 - DENGAN API KEY YANG BENAR
async function getCommodityPrices() {
  const API_KEY = process.env.COMMODITY_API_KEY;
  
  if (!API_KEY) {
    console.log("❌ COMMODITY_API_KEY tidak ditemukan di .env");
    console.log("📝 Daftar gratis di: https://commoditypriceapi.com/");
    return getMockCommodityPrices();
  }
  
  try {
    console.log("🔄 Mengambil data dari CommodityPriceAPI v2...");
    
    // COBA FORMAT 1: API Key di query parameter (apiKey)
    console.log("🔑 Menggunakan API Key di query parameter...");
    const response = await axios.get('https://api.commoditypriceapi.com/v2/rates/latest', {
      params: {
        apiKey: API_KEY,  // Nama parameter: apiKey (bukan apikey)
        symbols: 'XAU,XAG,WTI',
        base: 'USD'
      },
      timeout: 8000
    });
    
    console.log("✅ Status:", response.status);
    
    if (!response.data.success) {
      throw new Error(`API Error: ${response.data.message || 'Unknown error'}`);
    }
    
    const { rates, timestamp } = response.data;
    
    // Debug log
    console.log("📊 Rates received:", rates);
    
    const goldOunceUSD = rates.XAU || 0;
    const silverOunceUSD = rates.XAG || 0;
    const oilBarrelUSD = rates.WTI || 0;
    
    // Konversi ounce ke gram
    const goldGramUSD = goldOunceUSD ? parseFloat((goldOunceUSD / 31.1034768).toFixed(3)) : 0;
    const silverGramUSD = silverOunceUSD ? parseFloat((silverOunceUSD / 31.1034768).toFixed(3)) : 0;
    
    console.log(`📊 Data: Gold $${goldOunceUSD}/oz, Silver $${silverOunceUSD}/oz, Oil $${oilBarrelUSD}/barrel`);
    
    return {
      success: true,
      gold_gram_usd: goldGramUSD,
      gold_ounce_usd: goldOunceUSD,
      silver_gram_usd: silverGramUSD,
      silver_ounce_usd: silverOunceUSD,
      oil_usd: oilBarrelUSD,
      timestamp: timestamp * 1000,
      rawRates: rates,
      apiMethod: 'query-parameter'
    };
    
  } catch (error) {
    console.log("❌ Method 1 gagal:", error.message);
    
    // COBA FORMAT 2: API Key di header (x-api-key)
    try {
      console.log("🔄 Coba method 2: API Key di header...");
      const API_KEY = process.env.COMMODITY_API_KEY;
      
      const response = await axios.get('https://api.commoditypriceapi.com/v2/rates/latest', {
        params: {
          symbols: 'XAU,XAG,WTI',
          base: 'USD'
        },
        headers: {
          'x-api-key': API_KEY
        },
        timeout: 8000
      });
      
      console.log("✅ Status method 2:", response.status);
      
      if (!response.data.success) {
        throw new Error(`API Error: ${response.data.message || 'Unknown error'}`);
      }
      
      const { rates, timestamp } = response.data;
      
      const goldOunceUSD = rates.XAU || 0;
      const silverOunceUSD = rates.XAG || 0;
      const oilBarrelUSD = rates.WTI || 0;
      
      const goldGramUSD = goldOunceUSD ? parseFloat((goldOunceUSD / 31.1034768).toFixed(3)) : 0;
      const silverGramUSD = silverOunceUSD ? parseFloat((silverOunceUSD / 31.1034768).toFixed(3)) : 0;
      
      return {
        success: true,
        gold_gram_usd: goldGramUSD,
        gold_ounce_usd: goldOunceUSD,
        silver_gram_usd: silverGramUSD,
        silver_ounce_usd: silverOunceUSD,
        oil_usd: oilBarrelUSD,
        timestamp: timestamp * 1000,
        rawRates: rates,
        apiMethod: 'header'
      };
      
    } catch (error2) {
      console.log("❌ Method 2 juga gagal:", error2.message);
      
      // COBA FORMAT 3: Endpoint berbeda (v1 style)
      try {
        console.log("🔄 Coba method 3: Endpoint alternatif...");
        const API_KEY = process.env.COMMODITY_API_KEY;
        
        const response = await axios.get('https://api.commoditypriceapi.com/v1/latest', {
          params: {
            apikey: API_KEY,
            base: 'USD'
          },
          timeout: 8000
        });
        
        console.log("✅ Status method 3:", response.status);
        
        const rates = response.data.rates || response.data.data?.rates || {};
        
        const goldOunceUSD = rates.XAU || 0;
        const silverOunceUSD = rates.XAG || 0;
        const oilBarrelUSD = rates.WTI || 0;
        
        const goldGramUSD = goldOunceUSD ? parseFloat((goldOunceUSD / 31.1034768).toFixed(3)) : 0;
        const silverGramUSD = silverOunceUSD ? parseFloat((silverOunceUSD / 31.1034768).toFixed(3)) : 0;
        
        return {
          success: true,
          gold_gram_usd: goldGramUSD,
          gold_ounce_usd: goldOunceUSD,
          silver_gram_usd: silverGramUSD,
          silver_ounce_usd: silverOunceUSD,
          oil_usd: oilBarrelUSD,
          timestamp: Date.now(),
          rawRates: rates,
          apiMethod: 'v1-endpoint'
        };
        
      } catch (error3) {
        console.log("❌ Semua metode gagal, pakai mock data");
        return getMockCommodityPrices();
      }
    }
  }
}

// Mock data fallback
function getMockCommodityPrices() {
  console.log("📋 Menggunakan data mock...");
  
  const goldOunce = 1950.75 + (Math.random() - 0.5) * 20;
  const silverOunce = 23.42 + (Math.random() - 0.5) * 0.5;
  const oilPrice = 78.30 + (Math.random() - 0.5) * 2;
  
  return {
    success: false,
    gold_gram_usd: parseFloat((goldOunce / 31.1035).toFixed(3)),
    gold_ounce_usd: parseFloat(goldOunce.toFixed(2)),
    silver_gram_usd: parseFloat((silverOunce / 31.1035).toFixed(3)),
    silver_ounce_usd: parseFloat(silverOunce.toFixed(2)),
    oil_usd: parseFloat(oilPrice.toFixed(2)),
    timestamp: Date.now(),
    isMock: true
  };
}

// Kalkulasi perubahan
function calculateChange(current, previous) {
  if (!previous || previous === 0) return 0;
  const change = ((current - previous) / previous) * 100;
  return parseFloat(change.toFixed(2));
}

// Update semua data
async function updateAllData() {
  console.log("\n" + "=".repeat(60));
  console.log(`🔄 UPDATE DATA - ${new Date().toLocaleString('id-ID')}`);
  
  try {
    const [exchangeRate, commodityData] = await Promise.allSettled([
      getExchangeRate(),
      getCommodityPrices()
    ]);
    
    const exchangeRateValue = exchangeRate.status === 'fulfilled' ? exchangeRate.value : 15500;
    const commodityDataValue = commodityData.status === 'fulfilled' ? commodityData.value : getMockCommodityPrices();
    
    // Kalkulasi perubahan
    const goldChange = calculateChange(
      commodityDataValue.gold_gram_usd, 
      previousPrices.gold.gram_usd
    );
    
    const silverChange = calculateChange(
      commodityDataValue.silver_gram_usd,
      previousPrices.silver.gram_usd
    );
    
    const oilChange = calculateChange(
      commodityDataValue.oil_usd,
      previousPrices.oil.usd
    );
    
    // Simpan untuk perhitungan berikutnya
    previousPrices = {
      gold: { gram_usd: commodityDataValue.gold_gram_usd },
      silver: { gram_usd: commodityDataValue.silver_gram_usd },
      oil: { usd: commodityDataValue.oil_usd }
    };
    
    // Update cache
    cachedData = {
      prices: {
        gold: {
          gram_usd: commodityDataValue.gold_gram_usd,
          gram_idr: Math.round(commodityDataValue.gold_gram_usd * exchangeRateValue),
          ounce_usd: commodityDataValue.gold_ounce_usd,
          change: goldChange
        },
        silver: {
          gram_usd: commodityDataValue.silver_gram_usd,
          gram_idr: Math.round(commodityDataValue.silver_gram_usd * exchangeRateValue),
          ounce_usd: commodityDataValue.silver_ounce_usd,
          change: silverChange
        },
        oil: {
          usd: commodityDataValue.oil_usd,
          idr: Math.round(commodityDataValue.oil_usd * exchangeRateValue),
          change: oilChange
        }
      },
      usd_to_idr: exchangeRateValue,
      lastUpdate: new Date(),
      timestamp: commodityDataValue.timestamp,
      source: commodityDataValue.isMock ? 'Mock Data' : 'CommodityPriceAPI',
      success: commodityDataValue.success,
      apiMethod: commodityDataValue.apiMethod || 'unknown'
    };
    
    // Log hasil
    console.log("✅ DATA BERHASIL DIPERBARUI");
    console.log(`   Emas: $${cachedData.prices.gold.gram_usd}/g`);
    console.log(`         Rp ${cachedData.prices.gold.gram_idr.toLocaleString('id-ID')}/g`);
    console.log(`         ${goldChange > 0 ? '+' : ''}${goldChange}%`);
    console.log(`   Perak: $${cachedData.prices.silver.gram_usd}/g`);
    console.log(`          Rp ${cachedData.prices.silver.gram_idr.toLocaleString('id-ID')}/g`);
    console.log(`          ${silverChange > 0 ? '+' : ''}${silverChange}%`);
    console.log(`   Minyak: $${cachedData.prices.oil.usd}/bbl`);
    console.log(`           Rp ${cachedData.prices.oil.idr.toLocaleString('id-ID')}/bbl`);
    console.log(`           ${oilChange > 0 ? '+' : ''}${oilChange}%`);
    console.log(`   Kurs: 1 USD = Rp ${exchangeRateValue.toLocaleString('id-ID')}`);
    console.log(`   Sumber: ${cachedData.source} (${cachedData.apiMethod})`);
    console.log("=".repeat(60));
    
    return cachedData;
    
  } catch (error) {
    console.log("❌ Error update data:", error.message);
    return cachedData;
  }
}

// Helper functions untuk EJS
app.locals.formatNumber = (num) => num ? num.toLocaleString('id-ID') : '0';
app.locals.getChangeColor = (change) => 
  change > 0 ? '#10b981' : change < 0 ? '#ef4444' : '#8b949e';
app.locals.getChangeIcon = (change) => 
  change > 0 ? '↗' : change < 0 ? '↘' : '→';
app.locals.formatTime = (date) => 
  date ? new Date(date).toLocaleTimeString('id-ID') : '--:--:--';

// Routes
app.get("/", (req, res) => {
  res.render("index", { 
    prices: cachedData.prices,
    usdToIdr: cachedData.usd_to_idr,
    lastUpdate: cachedData.lastUpdate,
    source: cachedData.source,
    success: cachedData.success,
    apiMethod: cachedData.apiMethod
  });
});

// API endpoints
app.get("/api/prices", (req, res) => {
  res.json({
    success: true,
    data: cachedData.prices,
    meta: {
      usd_to_idr: cachedData.usd_to_idr,
      last_update: cachedData.lastUpdate,
      source: cachedData.source,
      api_method: cachedData.apiMethod,
      timestamp: Date.now()
    }
  });
});

app.get("/api/update", async (req, res) => {
  const newData = await updateAllData();
  res.json({
    success: true,
    message: "Data updated successfully",
    data: newData.prices,
    meta: {
      usd_to_idr: newData.usd_to_idr,
      last_update: newData.lastUpdate,
      source: newData.source,
      api_method: newData.apiMethod
    }
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    last_update: cachedData.lastUpdate,
    source: cachedData.source,
    api_key_set: !!process.env.COMMODITY_API_KEY
  });
});

// Auto-update setiap 3 menit
const UPDATE_INTERVAL = 3 * 60 * 1000;
setInterval(async () => {
  await updateAllData();
}, UPDATE_INTERVAL);

// Start server
const PORT = process.env.PORT || 1111;

// Initial update
updateAllData().then(() => {
  app.listen(PORT, () => {
    console.log("\n" + "=".repeat(50));
    console.log("🚀 TRADE.WEB.ID V2");
    console.log("=".repeat(50));
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`📊 API:   http://localhost:${PORT}/api/prices`);
    console.log(`❤️  Health: http://localhost:${PORT}/health`);
    console.log(`🔄 Auto-update: ${UPDATE_INTERVAL/60000} menit`);
    
    if (process.env.COMMODITY_API_KEY) {
      console.log(`🔑 API Key: ✓ SET (${process.env.COMMODITY_API_KEY.substring(0, 10)}...)`);
    } else {
      console.log("🔑 API Key: ✗ NOT SET - Gunakan data mock");
      console.log("📝 Daftar API key gratis di: https://commoditypriceapi.com/");
    }
    
    console.log("=".repeat(50));
  });
});