// Add your OpenWeatherMap API key here
const API_KEY = '9c3d90e4d40720c89dbc78143e1efe36';
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

// Store references to HTML UI Containers / elements for easy DOM manipulation
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const suggestionsList = document.getElementById('suggestions-list');
const weatherCard = document.getElementById('weather-card');
const errorMessage = document.getElementById('error-message');
const loading = document.getElementById('loading');

// DOM Elements specifically for interpolating weather data values
const cityNameEl = document.getElementById('city-name');
const weatherIconEl = document.getElementById('weather-icon');
const tempEl = document.getElementById('temp');
const weatherDescEl = document.getElementById('weather-desc');
const humidityEl = document.getElementById('humidity');
const windSpeedEl = document.getElementById('wind-speed');

// ==========================================
// EVENT LISTENERS SECTION
// ==========================================

let debounceTimeout; // System variable tracking timer to prevent excessive API calls while typing

// Listen to text input to trigger the autocomplete
cityInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    
    // Clear the previous timer if the user types quickly continuously
    clearTimeout(debounceTimeout);
    
    // If input was erased or is empty, we hide the suggestion box immediately
    if (!value) {
        hideElement(suggestionsList);
        return;
    }
    
    // Wait for the user to stop typing for 300 milliseconds before calling the Geocode API 
    // This technique is 'debouncing' and saves network bandwidth
    debounceTimeout = setTimeout(() => {
        fetchCitySuggestions(value);
    }, 300);
});

// Close autocomplete suggestions when user clicks anywhere outside the search bar/list container
document.addEventListener('click', (e) => {
    if (!cityInput.contains(e.target) && !suggestionsList.contains(e.target)) {
        hideElement(suggestionsList);
    }
});

// Trigger a weather search manually when user clicks magnifying glass button
searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) {
        hideElement(suggestionsList);
        getWeatherData(city);
    }
});

// Trigger a weather search manually when user hits 'Enter' on their keyboard
cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = cityInput.value.trim();
        if (city) {
            hideElement(suggestionsList);
            getWeatherData(city);
        }
    }
});

// ==========================================
// API FETCH AND LOGIC SECTION
// ==========================================

/**
 * Fetch city suggestions using Open-Meteo Geocoding API.
 * This is used for generating suggestions in the dropdown list.
 * It is highly reliable for partial names and small rural locations.
 * @param {string} query - The search text matching user input.
 */
async function fetchCitySuggestions(query) {
    try {
        // Query Free API endpoint matching partial string text, asking it to return up to 8 places in English language
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`);
        if (!response.ok) throw new Error('Failed to fetch suggestions');
        
        const data = await response.json();
        // Forward the matched results to renderer block
        displaySuggestions(data.results || []);
    } catch (error) {
        console.error('Error fetching city suggestions:', error);
    }
}

/**
 * Render visual city suggestions list in the HTML dropdown menu
 * @param {Array} cities - List of city objects given back by the Geocoder.
 */
function displaySuggestions(cities) {
    // Empty previously shown items
    suggestionsList.innerHTML = '';
    
    // Check if there are matches. Hide the panel if it's empty
    if (!cities || cities.length === 0) {
        hideElement(suggestionsList);
        return;
    }
    
    // Loop over each resulting city and construct HTML strings to show
    cities.forEach(city => {
        const li = document.createElement('li');
        
        // Open-Meteo returns 'admin1' parameter as province or state. Append comma syntax for better look
        const state = city.admin1 ? `${city.admin1}, ` : '';
        const country = city.country || '';
        
        // Combine all address portions physically formatted inside the created <li>
        li.innerHTML = `
            <span class="city-name-suggestion">${city.name}</span>
            <span class="city-state-suggestion">${state}${country}</span>
        `;
        
        // When user specifically clicks this li text:
        li.addEventListener('click', () => {
            // Apply text physically to search input
            cityInput.value = city.name;
            // Clean up visual board
            hideElement(suggestionsList);
            // Initiate core logic fetching using these explicit coordinates guarantees OWM sees tiny towns 
            getWeatherData(city.name, city.latitude, city.longitude, city.country);
        });
        
        suggestionsList.appendChild(li);
    });
    
    // Show properly populated panel to user
    showElement(suggestionsList);
}

/**
 * Core function handling API fetch requests for extracting weather status
 * @param {string} query - The location query string (used to query Geocoder if latitude missing)
 * @param {number|null} lat - Precise latitude from Geocoder click (optional)
 * @param {number|null} lon - Precise longitude from Geocoder click (optional)
 * @param {string|null} country - Proper country name (optional)
 */
async function getWeatherData(query, lat = null, lon = null, country = null) {
    // UI reset block - Show loading indicator whilst HTTP requests resolve
    hideElement(weatherCard);
    hideElement(errorMessage);
    showElement(loading);

    try {
        let finalLat = lat;
        let finalLon = lon;
        let locationName = query;
        let locationCountry = country;

        // Validation - if user hasn't clicked a valid suggestion and pressed Enter
        // we forcefully retrieve exact coordinates belonging to query text first for compatibility
        if (finalLat === null || finalLon === null) {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
            if (!geoRes.ok) throw new Error('Failed to fetch location data.');
            
            const geoData = await geoRes.json();
            
            if (!geoData.results || geoData.results.length === 0) {
                // Return gracefully if user gave utter gibberish
                throw new Error('Location not found. Please check the spelling or search for a nearby larger town.');
            }
            
            // Assign retrieved explicit coordinate set to execution blocks matching highest population place possible
            finalLat = geoData.results[0].latitude;
            finalLon = geoData.results[0].longitude;
            locationName = geoData.results[0].name;
            locationCountry = geoData.results[0].country || '';
            
            // Apply proper name formatting backward to graphical input field automatically
            cityInput.value = locationName;
        }

        // Fetch complete metric unit data structure off OpenWeatherMap based upon the generated final coordinates
        const response = await fetch(`${BASE_URL}?lat=${finalLat}&lon=${finalLon}&appid=${API_KEY}&units=metric`);

        if (!response.ok) {
            if (response.status === 401) {
                // Triggered if developer provides malfunctioning api-keys
                throw new Error('Invalid API Key. Please enter a valid OpenWeatherMap API Key in script.js.');
            } else {
                throw new Error('An error occurred while fetching weather data.');
            }
        }

        const data = await response.json();
        
        // Append manually verified names directly rather than relying upon OpenWeatherMap resolving village mapping natively
        data.customName = locationName;
        data.customCountry = locationCountry;
        
        // Push resulting properties backwards onto UI graph elements visually
        updateUI(data);
    } catch (error) {
        // Render explicit warnings passed from validation throwing mechanics
        showError(error.message);
    } finally {
        // Discard buffering icon text once promise resolves regardless of fail/success
        hideElement(loading);
    }
}

// ==========================================
// RENDERER SECTION
// ==========================================

/**
 * Translates JSON metadata physically mapped directly onto visible element content.
 * @param {Object} data - Processed weather configuration JSON mapped backward from OpenWeatherMap
 */
function updateUI(data) {
    // Utilize forced name/country or fallback generically (e.g. valid data customName otherwise fallback JSON data.name)
    const name = data.customName || data.name;
    const country = data.customCountry || data.sys.country;
    
    cityNameEl.textContent = country ? `${name}, ${country}` : name;

    // Mathematical rounding to closest 1 decimal representation for primary degrees 
    tempEl.textContent = Math.round(data.main.temp * 10) / 10;

    // Apply primary descriptive wordings
    weatherDescEl.textContent = data.weather[0].description;

    // Pull correct visualization code matching API index icon mapping structure onto image graphic dynamically 
    const iconCode = data.weather[0].icon;
    weatherIconEl.src = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;

    // Apply extra supplementary numeric weather fields 
    humidityEl.textContent = `${data.main.humidity}%`;
    windSpeedEl.textContent = `${data.wind.speed} m/s`;

    // Reveal primary UI grouping
    showElement(weatherCard);
}

/**
 * Handle displaying an inline visual textual warning box upon catch events resolving
 * @param {string} message - Warning message syntax block to exhibit
 */
function showError(message) {
    errorMessage.textContent = message;
    showElement(errorMessage);
}

// ==========================================
// HELPER SECTION
// ==========================================

// Global generic functions handling basic UI toggles via utility CSS
function showElement(el) {
    el.classList.remove('hidden');
}

function hideElement(el) {
    el.classList.add('hidden');
}
