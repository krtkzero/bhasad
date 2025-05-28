import React, { useState, useEffect, useRef } from 'react'
import tt from '@tomtom-international/web-sdk-maps'
import '@tomtom-international/web-sdk-maps/dist/maps.css'
import html2canvas from 'html2canvas'

// Add type declaration for Vite env variables
// interface ImportMeta {
//   env: {
//     VITE_TOMTOM_KEY: string
//     VITE_OPENWEATHER_KEY: string
//     VITE_HUGGINGFACE_KEY: string
//     VITE_NEWSAPI_KEY: string
//   }
// }

interface Location {
  lat: number;
  lng: number;
}

interface ChaosScore {
  score: number;
  description: string;
  emoji: string;
  breakdown: {
    traffic: number;
    rain: number;
    temp: number;
    peak: number;
  }
}

const languages = [
  { code: 'en', text: 'Bhasad Score' },
  { code: 'hi', text: 'भसड़ स्कोर' },
  { code: 'ta', text: 'குழப்ப மதிப்பெண்' },
  { code: 'bn', text: 'ঝামেলার স্কোর' },
  { code: 'mr', text: 'गोंधळ गुण' },
  { code: 'te', text: 'గందరగోళ స్కోర్' },
  { code: 'kn', text: 'ಗದ್ದಲ ಸ್ಕೋರ್' },
  { code: 'ml', text: 'കു്പം സ്കോർ' },
  { code: 'pa', text: 'ਭਸੜ ਸਕੋਰ' },
  { code: 'gu', text: 'ભસડ સ્કોર' }
]

function App() {
  const [currentLanguage, setCurrentLanguage] = useState(0)
  const [location, setLocation] = useState<Location>({ lat: 28.6139, lng: 77.2090 })
  const [chaosScore, setChaosScore] = useState<ChaosScore>({
    score: 0,
    description: 'Loading...',
    emoji: '⏳',
    breakdown: { traffic: 0, rain: 0, temp: 0, peak: 0 }
  })
  const [isLoading, setIsLoading] = useState(false)
  const mapRef = useRef<tt.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<tt.Marker | null>(null)
  const [showCard, setShowCard] = useState(false)
  const [cardImage, setCardImage] = useState<string | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const [newsBhasad, setNewsBhasad] = useState<{score: number, articles: {title: string, url: string}[]}>({score: 0, articles: []})

  // Initialize map
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      mapRef.current = tt.map({
        key: import.meta.env.VITE_TOMTOM_KEY,
        container: mapContainerRef.current,
        center: [location.lng, location.lat],
        zoom: 12
      })

      // Add click handler to map
      mapRef.current.on('click', (e) => {
        const { lng, lat } = e.lngLat
        updateLocation(lat, lng)
      })

      // Add marker
      markerRef.current = new tt.Marker()
        .setLngLat([location.lng, location.lat])
        .addTo(mapRef.current)
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Update map when location changes
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      mapRef.current.setCenter([location.lng, location.lat])
      markerRef.current.setLngLat([location.lng, location.lat])
    }
  }, [location])

  // Language rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLanguage((prev) => (prev + 1) % languages.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const updateLocation = async (lat: number, lng: number) => {
    setLocation({ lat, lng })
    await calculateChaosScore(lat, lng)
  }

  const handleUseMyLocation = async () => {
    setIsLoading(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject)
      })
      await updateLocation(position.coords.latitude, position.coords.longitude)
    } catch (error) {
      console.error('Error getting location:', error)
      alert('Could not get your location. Please check your location permissions.')
    }
    setIsLoading(false)
  }

  const fetchNewsBhasad = async (lat: number, lng: number) => {
    try {
      // Use reverse geocoding to get city and state name for better news search
      let city = ''
      let state = ''
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
        const geoData = await geoRes.json()
        city = geoData.address.city || geoData.address.town || geoData.address.village || ''
        state = geoData.address.state || ''
      } catch {} // ignore geo-coding errors, news fetch can proceed
      // Build query: always include 'local news' for more local relevance
      let query = ''
      if (city && state && !city.toLowerCase().includes(state.toLowerCase())) {
        query = city + ' ' + state + ' local news'
      } else if (city) {
        query = city + ' local news'
      } else if (state) {
        query = state + ' local news'
      } else {
        query = 'India local news'
      }
      // Fetch news
      const newsRes = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&apiKey=${import.meta.env.VITE_NEWSAPI_KEY}&language=en&sortBy=publishedAt&pageSize=10`)
      const newsData = await newsRes.json()
      const bhasadKeywords = ['accident','flood','protest','strike','jam','chaos','disaster','alert','rain','storm','violence','blockade','shutdown','curfew','fire','collapse','crash','riot','emergency','warning']
      const relevantArticles = (newsData.articles || []).filter((article: any) =>
        bhasadKeywords.some(word =>
          (article.title && article.title.toLowerCase().includes(word)) ||
          (article.description && article.description.toLowerCase().includes(word))
        )
      )
      setNewsBhasad({
        score: Math.min(relevantArticles.length, 3),
        articles: relevantArticles.slice(0, 2).map((a: any) => ({title: a.title, url: a.url}))
      })
      return Math.min(relevantArticles.length, 3)
    } catch (e) {
      setNewsBhasad({score: 0, articles: []})
      return 0
    }
  }

  const calculateChaosScore = async (lat: number, lng: number) => {
    setIsLoading(true)
    try {
      // 1. Get traffic data from TomTom
      const trafficRes = await fetch(
        `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point=${lat},${lng}&key=${import.meta.env.VITE_TOMTOM_KEY}`
      )
      const trafficData = await trafficRes.json()
      let trafficScore = 0
      if (trafficData.flowSegmentData) {
        const currentSpeed = trafficData.flowSegmentData.currentSpeed
        const freeFlowSpeed = trafficData.flowSegmentData.freeFlowSpeed
        const ratio = 1 - (currentSpeed / freeFlowSpeed)
        trafficScore = Math.round(Math.min(Math.max(ratio, 0), 1) * 10)
      }

      // 2. Get weather data from OpenWeather
      const weatherRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${import.meta.env.VITE_OPENWEATHER_KEY}&units=metric`
      )
      const weatherData = await weatherRes.json()
      console.log('OpenWeather data:', weatherData)
      // Rain (granular)
      const rainAmount = (weatherData.rain && (weatherData.rain['1h'] || weatherData.rain['3h'])) || 0;
      let rainScore = Math.min(Math.round(rainAmount * 2), 10); // 5mm+ rain = 10/10

      // If no rain amount, check weather conditions
      if (rainScore === 0 && weatherData.weather && weatherData.weather[0]) {
        const main = weatherData.weather[0].main;
        const description = weatherData.weather[0].description.toLowerCase();
        
        // Base scores for different weather conditions
        if (main === "Rain" || main === "Thunderstorm" || main === "Drizzle") {
          rainScore = 5; // moderate rain
        }
        
        // Additional conditions
        if (description.includes('heavy') || description.includes('intense')) {
          rainScore = Math.max(rainScore, 8);
        } else if (description.includes('light') || description.includes('shower')) {
          rainScore = Math.max(rainScore, 3);
        }
      }

      // Consider humidity
      const humidity = weatherData.main.humidity || 0;
      if (humidity > 90) {
        rainScore = Math.max(rainScore, 4); // high humidity often means rain
      } else if (humidity > 80) {
        rainScore = Math.max(rainScore, 2);
      }

      // If there are weather alerts/warnings, bump the score
      if (weatherData.alerts && weatherData.alerts.length > 0) {
        const alertSeverity = weatherData.alerts[0].severity?.toLowerCase() || '';
        if (alertSeverity.includes('extreme') || alertSeverity.includes('severe')) {
          rainScore = 10;
        } else if (alertSeverity.includes('warning')) {
          rainScore = Math.max(rainScore, 7);
        } else {
          rainScore = Math.max(rainScore, 5);
        }
      }

      // Temperature
      const temp = weatherData.main.temp
      const tempScore =
        temp > 38 ? 10 :
        temp > 33 ? 8 :
        temp < 15 ? 7 :
        temp < 10 ? 9 :
        2
      // Peak hour
      const hour = new Date().getHours()
      const peakBump = (hour >= 8 && hour <= 11) || (hour >= 18 && hour <= 21) ? 1 : 0

      // News bhasad
      const newsScore = await fetchNewsBhasad(lat, lng)
      // Final weighted score (add newsScore)
      const rawScore =
        trafficScore * 0.5 +
        rainScore * 0.25 +
        tempScore * 0.25 +
        newsScore
      const bhasadScore = Math.min(Number((rawScore + peakBump).toFixed(1)), 10)

      // Description and emoji
      let description = ''
      let emoji = ''
      if (bhasadScore >= 9) {
        description = '🚨 Extreme chaos! Stay safe and avoid going out if possible.'
        emoji = '🥵'
      } else if (bhasadScore >= 7) {
        description = '😰 High chaos. Expect heavy traffic and tough conditions.'
        emoji = '😰'
      } else if (bhasadScore >= 5) {
        description = '😬 Moderate chaos. Usual Indian city hustle.'
        emoji = '😬'
      } else {
        description = '😊 Low chaos. Enjoy the peace while it lasts!'
        emoji = '😊'
      }

      setChaosScore({
        score: bhasadScore,
        description,
        emoji,
        breakdown: {
          traffic: trafficScore,
          rain: rainScore,
          temp: tempScore,
          peak: peakBump
        }
      })
    } catch (error) {
      console.error('Error calculating chaos score:', error)
      setChaosScore({
        score: 0,
        description: 'Could not calculate chaos score. Please try again.',
        emoji: '❓',
        breakdown: { traffic: 0, rain: 0, temp: 0, peak: 0 }
      })
    }
    setIsLoading(false)
  }

  // Initial calculation
  useEffect(() => {
    calculateChaosScore(location.lat, location.lng)
    // eslint-disable-next-line
  }, [])

  // Bhasadmon names based on chaos level
  const getBhasadmonName = (score: number) => {
    const names: { [key: number]: string } = {
      1: "Chillmon - The Zen Master",
      2: "Peacemon - The Serene One",
      3: "Calmmon - The Cool Cat",
      4: "Mildmon - The Gentle Giant",
      5: "Chaosmon - The Regular Ruckus",
      6: "Ruckusmon - The Mild Mayhem",
      7: "Havocmon - The Heavy Hitter",
      8: "Frenzymon - The Wild One",
      9: "Apocalypsemon - The Ultimate Chaos",
      10: "Bhasadmon - The Legendary Chaos Lord"
    }
    const roundedScore = Math.min(Math.max(Math.round(score), 1), 10)
    return names[roundedScore]
  }

  // Get Bhasadmon image based on score
  const getBhasadmonImage = (score: number) => {
    // Round score to nearest integer between 1-10
    const roundedScore = Math.min(Math.max(Math.round(score), 1), 10)
    return `/bhasadmon/${roundedScore}.png`
  }

  // Generate image when card is shown
  useEffect(() => {
    if (showCard) {
      setCardImage(getBhasadmonImage(chaosScore.score))
    }
  }, [showCard, chaosScore.score])

  // Download card as image
  const handleDownloadCard = async () => {
    if (!cardRef.current) {
      console.error('Card reference not found');
      return;
    }

    try {
      // Simple html2canvas call with minimal options
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2
      });

      // Convert to data URL and download
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `bhasadmon-${Math.round(chaosScore.score)}.png`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Error downloading card:', error);
      alert('Failed to download card. Please try again.');
    }
  }

  return (
    <div className="app">
      {/* Top Bar */}
      <header className="header">
        <div className="header-content">
          <h1 className="title">
            {languages[currentLanguage].text}
          </h1>
          <button 
            onClick={handleUseMyLocation}
            disabled={isLoading}
            className="button"
          >
            {isLoading ? 'Loading...' : '📍 Use My Location'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <div className="content">
          {/* Map Section */}
          <div className="map-container">
            <div ref={mapContainerRef} className="map"></div>
          </div>

          {/* Score Section */}
          <div className="score-card">
            <p className="location">
              Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </p>
            <div className="score">
              <h2 className="score-value">
                Bhasad Score: {chaosScore.score}/10
              </h2>
              <span className="emoji">{chaosScore.emoji}</span>
            </div>
            <p className="description">
              {chaosScore.description}
            </p>
            <div style={{marginBottom: '1rem'}}>
              <strong>Breakdown:</strong>
              <ul style={{fontSize: '0.95em', color: '#6b7280', margin: 0, padding: 0, listStyle: 'none'}}>
                <li>🚗 Traffic: <b>{chaosScore.breakdown.traffic}</b>/10</li>
                <li>🌧️ Rain: <b>{chaosScore.breakdown.rain}</b>/10</li>
                <li>🔥 Temp: <b>{chaosScore.breakdown.temp}</b>/10</li>
                <li>⏰ Peak Hour Bonus: <b>{chaosScore.breakdown.peak}</b></li>
                <li>📰 News Bhasad: <b>{newsBhasad.score}</b>/3</li>
              </ul>
            </div>
            {/* News Bhasad Section (main card) */}
            <div style={{width: '100%', background: '#fff6', borderRadius: 8, padding: 8, marginBottom: 8}}>
              <div style={{fontWeight: 'bold', color: '#a21caf', marginBottom: 4}}>News Bhasad Found</div>
              {newsBhasad.articles.length === 0 ? (
                <div style={{fontSize: 14, color: '#78350f'}}>No major bhasad in the news right now.</div>
              ) : (
                <ul style={{fontSize: 14, color: '#78350f', margin: 0, padding: 0, listStyle: 'none'}}>
                  {newsBhasad.articles.map((a, i) => (
                    <li key={i} style={{marginBottom: 4}}>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" style={{color: '#a21caf', textDecoration: 'underline'}}>{a.title}</a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button 
              onClick={() => calculateChaosScore(location.lat, location.lng)}
              disabled={isLoading}
              className="recalculate-button"
            >
              {isLoading ? 'Calculating...' : 'Recalculate Score'}
            </button>
            <button
              style={{marginTop: '1rem', width: '100%', background: '#fbbf24', color: '#78350f', fontWeight: 'bold', borderRadius: '0.5rem', padding: '0.5rem 1rem', border: 'none', cursor: 'pointer'}}
              onClick={() => setShowCard(true)}
            >
              🎴 Share as Card
            </button>
          </div>
        </div>
      </main>

      {/* Pokemon-style Card Modal */}
      {showCard && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div ref={cardRef} style={{
            background: 'linear-gradient(135deg, #fbbf24 60%, #f472b6 100%)',
            border: '6px solid #222',
            borderRadius: '1.5rem',
            width: 340,
            minHeight: 560,
            boxShadow: '0 8px 32px #0006',
            padding: '1.5rem 1rem',
            position: 'relative',
            fontFamily: 'monospace',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transform: 'translateZ(0)', // Force GPU rendering
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale'
          }}>
            <div style={{position: 'absolute', top: 16, right: 16, zIndex: 1}}>
              <button onClick={() => setShowCard(false)} style={{background: 'none', border: 'none', fontSize: 24, cursor: 'pointer'}}>✖️</button>
            </div>
            <div style={{fontWeight: 'bold', fontSize: 22, color: '#78350f', letterSpacing: 2, marginBottom: 8, textAlign: 'center'}}>
              {getBhasadmonName(chaosScore.score)}
            </div>
            <div style={{
              width: 120,
              height: 120,
              background: '#fff',
              borderRadius: '50%',
              border: '4px solid #78350f',
              margin: '0.5rem 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 54,
              overflow: 'hidden',
              position: 'relative'
            }}>
              {isImageLoading ? (
                <span style={{fontSize: 18, color: '#78350f'}}>Loading...</span>
              ) : cardImage ? (
                <img 
                  src={cardImage} 
                  alt={`Bhasadmon Level ${Math.round(chaosScore.score)}`} 
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    position: 'absolute',
                    top: 0,
                    left: 0
                  }} 
                />
              ) : (
                chaosScore.emoji
              )}
            </div>
            <div style={{fontWeight: 'bold', fontSize: 18, color: '#222', margin: '0.5rem 0'}}>
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </div>
            <div style={{fontWeight: 'bold', fontSize: 24, color: '#222', margin: '0.5rem 0'}}>
              {chaosScore.score}/10
            </div>
            <div style={{fontSize: 16, color: '#222', marginBottom: 8, textAlign: 'center'}}>
              {chaosScore.description}
            </div>
            <div style={{width: '100%', background: '#fff3', borderRadius: 8, padding: 8, marginTop: 8}}>
              <div style={{fontWeight: 'bold', color: '#78350f', marginBottom: 4}}>Breakdown</div>
              <ul style={{fontSize: 15, color: '#78350f', margin: 0, padding: 0, listStyle: 'none'}}>
                <li>🚗 Traffic: <b>{chaosScore.breakdown.traffic}</b>/10</li>
                <li>🌧️ Rain: <b>{chaosScore.breakdown.rain}</b>/10</li>
                <li>🔥 Temp: <b>{chaosScore.breakdown.temp}</b>/10</li>
                <li>⏰ Peak: <b>{chaosScore.breakdown.peak}</b></li>
                <li>📰 News Bhasad: <b>{newsBhasad.score}</b>/3</li>
              </ul>
            </div>
            <div style={{marginTop: 16, textAlign: 'center'}}>
              <small style={{color: '#78350f'}}>Share your Bhasadmon with friends!</small>
            </div>
            <button
              onClick={handleDownloadCard}
              style={{marginTop: 18, width: '100%', background: '#fff', color: '#a21caf', fontWeight: 'bold', borderRadius: '0.5rem', padding: '0.5rem 1rem', border: '2px solid #a21caf', cursor: 'pointer', fontSize: 16}}
            >
              ⬇️ Download Card
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App