/* eslint-env browser */
/* global L Swal */

const imgs = {
    colours: 'https://cdn.discordapp.com/attachments/519997113652871181/1036334255925624872/Candy.png',
    popup: 'https://cdn.discordapp.com/attachments/519997113652871181/1036336565607206922/unknown.png',
};

window.hcdb = {};

const getHome = async (id) => {
    let req;
    try {
        req = await fetch(`/api/house/${id}`);
    } catch (e) {
        return null;
    }
    if (req.ok) {
        return await req.json();
    }
    return null;
};

const getRandomHome = async () => {
    let req;
    try {
        req = await fetch('/api/house/random');
    } catch (e) {
        return null;
    }
    if (req.ok) {
        return await req.json();
    }
    return null;
};

const processSubmissions = (submissions) => {
    if (!submissions || Object.keys(submissions).length === 0) return null;

    const averages = {};

    for (const submission of submissions) {
        for (const [key, value] of Object.entries(submission)) {
            if (key === 'noCandyReason') continue;
            if (!averages[key]) averages[key] = [];
            averages[key].push(value);
        }
    }

    for (const [key, value] of Object.entries(averages)) {
        averages[key] = value.reduce((a, b) => a + b, 0) / value.length;
    }

    return averages;
};

const processColors = (averages, length) => {
    const hue = (averages.candyType + averages.candyCount) * 50;
    const saturation = Math.min(length / 5, 1);
    const lightness = averages.candy;
    return `hsl(${hue}, ${saturation * 100}%, ${lightness * 50}%)`;
};

const loadedPolygons = [];

let map;

const boolRangeToWords = (range) => {
    if (range >= 0.90) return 'Yes';
    if (range >= 0.75) return 'Most Likely';
    if (range >= 0.50) return 'Maybe';
    if (range >= 0.25) return 'Probably Not';
    return 'No';
};

const makeHomePopup = (home) => {
    const submissions = processSubmissions(home.submissions);

    const popup = document.createElement('div');
    popup.classList.add('popup');

    const title = document.createElement('h2');
    title.innerText = 'Details';
    popup.appendChild(title);

    if (!submissions) {
        const noSubmissions = document.createElement('p');
        noSubmissions.innerText = 'No submissions yet!';
        popup.appendChild(noSubmissions);
    } else {
        const candy = document.createElement('p');
        candy.innerText = `Gives Candy: ${boolRangeToWords(submissions.candy)}`;
        popup.appendChild(candy);
        if (submissions.candyType !== undefined && submissions.candyCount !== undefined) {
            const candyType = document.createElement('p');
            candyType.innerText = `Satisfaction with Quality: ${Math.round(submissions.candyType * 100)}%`;
            const candyCount = document.createElement('p');
            candyCount.innerText = `Satisfaction with Quantity: ${Math.round(submissions.candyCount * 100)}%`;
            popup.appendChild(candyType);
            popup.appendChild(candyCount);
        }
        const submissionCount = document.createElement('p');
        submissionCount.innerText = `Number of Submissions: ${home.submissions.length}`;
        popup.appendChild(submissionCount);
    }

    const submit = document.createElement('button');
    submit.innerText = 'Submit a Report';
    submit.onclick = () => {
        if (!window.hcdb.auth.loggedIn) {
            window.hcdb.login();
            return;
        }
        window.hcdb.promptSubmission(home.id);
    };
    popup.appendChild(submit);

    const refresh = document.createElement('button');
    refresh.innerText = 'Refresh';
    refresh.onclick = () => {
        return window.hcdb.updateLoadedHome(home.id);
    };
    popup.appendChild(refresh);
    return popup;
};
const makePolygon = (coords, popup, {
    color = 'grey',
} = {}) => {
    if (!map) return;
    const polygon = new L.Polygon(coords, {
        color,
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.5,
    });
    polygon.addTo(map);
    loadedPolygons.push(polygon);
    if (popup) polygon.bindPopup(popup);
    return polygon;
};

const clearPolygons = () => {
    loadedPolygons.forEach(p => p.remove());
};

const displayRandomHome = async () => {
    const home = await getRandomHome();

    if (!home) return;

    clearPolygons();

    const polygon = makePolygon(home.geometry.coordinates[0], makeHomePopup(home), {
        color: home.submissions ? processColors(processSubmissions(home.submissions), home.submissions.length) : undefined,
    });

    map.fitBounds(polygon.getBounds());

    return home;
};

const displaySpecificHome = async (id) => {
    clearPolygons();
    const home = await getHome(id);

    if (!home) return;

    const polygon = makePolygon(home.geometry.coordinates[0], makeHomePopup(home), {
        color: home.submissions ? processColors(processSubmissions(home.submissions), home.submissions.length) : undefined,
    });

    map.fitBounds(polygon.getBounds());

    return home;
};

const getHomeInBounds = async (nw, se) => {
    if (!nw || !se) {
        const bounds = map.getBounds();

        nw = bounds.getNorthWest();
        se = bounds.getSouthEast();
    }


    return await fetch(`/api/homes/in?nwLat=${nw.lat}&nwLng=${nw.lng}&seLat=${se.lat}&seLng=${se.lng}`)
        .then(res => {
            if (res.ok) return res.json();
            else return null;
        })
        .catch(console.error);
};

const displayHomesInBounds = async (homes) => {
    if (!homes)
        homes = await getHomeInBounds();
    if (!homes) return alert('Error loading homes');

    clearPolygons();
    homes.forEach(home => {
        makePolygon(home.geometry.coordinates[0], makeHomePopup(home), {
            color: home.submissions ? processColors(processSubmissions(home.submissions), home.submissions.length) : undefined,
        });
    });
};

const getAccount = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.hcdb.auth = { loggedIn: false };
        return null;
    }
    const details = await fetch('/api/me', {
        headers: {
            Authorization: `${token}`,
        },
    })
        .then(res => {
            if (res.ok) return res.json();
            else return null;
        })
        .catch(console.error);
    if (!details || !details.success) {
        localStorage.removeItem('token');
        window.hcdb.auth = { loggedIn: false };
        return null;
    }

    window.hcdb.auth = {
        token,
        details,
        loggedIn: true,
    };
    return details;

};

const submitWithAlert = async (url, fetchData) => {
    const alert = Swal.fire({
        title: 'Loading...',
        allowOutsideClick: false,
        showConfirmButton: false,
        allowEscapeKey: false,
        onBeforeOpen: () => {
            Swal.showLoading();
        },
    });

    try {
        const res = await fetch(url, fetchData);
        if (res.ok) {
            alert.close();
            Swal.fire({
                title: 'Success!',
                icon: 'success',
                timer: 1000,
            });
            return res;
        } else {
            alert.close();
            const msg = await res.text();
            try {
                const json = JSON.parse(msg);
                Swal.fire({
                    title: 'Error',
                    icon: 'error',
                    text: json.error || json.message,
                });
            } catch (e) {
                Swal.fire({
                    title: 'Error',
                    text: msg,
                    type: 'error',
                });
            }
        }
    } catch (e) {
        alert.close();
        Swal.fire({
            title: 'Error',
            text: e.message,
            icon: 'error',
        });
    }
};



window.hcdb.promptSubmission = async (id) => {
    /*
    Must either be:
    { 
        "candy": true, 
        "candyType": 1, // Number between 0 and 1 
        "candyCount": 1, // Number between 0 and 1
     }
    
     or 
     {
        "candy": false,
        "noCandyReason": "notHome" | "noCandy"
     }
    */

    const { value: candy } = await Swal.fire({
        title: 'Did you get candy?',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Yes',
        denyButtonText: 'No',
        icon: 'question',
    });

    if (candy === undefined) return;

    console.log(candy);

    if (!candy) {
        const { value: noCandyReason } = await Swal.fire({
            title: 'Why didn\'t you get candy?',
            input: 'select',
            icon: 'question',
            inputOptions: {
                'notHome': 'Not a home',
                'noCandy': 'They did not give out candy',
            },
            inputPlaceholder: 'Select a reason',
            showCancelButton: true,
            allowOutsideClick: false,
            inputValidator: (value) => {
                if (!value) {
                    return 'You need to select a reason!';
                }
            }
        });

        if (noCandyReason === undefined) return;

        console.log(noCandyReason);

        await submitWithAlert(`/api/house/${id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: window.hcdb.auth.token,
            },
            body: JSON.stringify({
                candy: false,
                noCandyReason,
            }),
        });
        await window.hcdb.updateLoadedHome(id);

        return;
    }
    let { value: candyType } = await Swal.fire({
        title: 'What did you think of the quality of the candy you got?',
        input: 'select',
        icon: 'question',
        inputOptions: {
            '0': 'Terrible',
            '1': 'Bad',
            '2': 'Average',
            '3': 'Good',
            '4': 'Great',
        },
        inputPlaceholder: 'Select a rating',
        showCancelButton: true,
        allowOutsideClick: false,
        inputValidator: (value) => {
            if (!value) {
                return 'You need to select a rating!';
            }
        }
    });

    if (candyType === undefined) return;

    console.log(candyType);

    candyType = parseInt(candyType) / 4;

    let { value: candyCount } = await Swal.fire({
        title: 'What do you think of the quantity of candy you got?',
        input: 'select',
        icon: 'question',
        inputOptions: {
            '0': 'Terrible',
            '1': 'Bad',
            '2': 'Average',
            '3': 'Good',
            '4': 'Great',
        },
        inputPlaceholder: 'Select a rating',
        showCancelButton: true,
        allowOutsideClick: false,
        inputValidator: (value) => {
            if (!value) {
                return 'You need to select a rating!';
            }
        }
    });

    if (candyCount === undefined) return;

    console.log(candyCount);

    candyCount = parseInt(candyCount) / 4;

    await submitWithAlert(`/api/house/${id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: window.hcdb.auth.token,
        },
        body: JSON.stringify({
            candy: true,
            candyType,
            candyCount,
        }),
    });

    await window.hcdb.updateLoadedHome(id);

};

let accountSpan;

const updateAccountSpan = async () => {
    const account = await getAccount();
    if (account) {
        const a = document.createElement('a');
        a.href = 'javascript:hcdb.logout()';
        a.innerText = account.username;
        accountSpan.innerHTML = 'Logged in as ';
        accountSpan.appendChild(a);
    } else {
        const a = document.createElement('a');
        a.href = 'javascript:hcdb.login()';
        a.innerText = 'Login';
        accountSpan.innerHTML = '';
        accountSpan.appendChild(a);
        accountSpan.innerHTML += ' - ';
        const a2 = document.createElement('a');
        a2.href = 'javascript:hcdb.register()';
        a2.innerText = 'Register';
        accountSpan.appendChild(a2);

    }
    const help  = document.createElement('a');
    help.href = 'javascript:hcdb.welcome()';
    help.innerText = 'Help';
    accountSpan.innerHTML += ' - ';
    accountSpan.appendChild(help);

};

window.hcdb.login = async () => {
    const { value: formValues } = await Swal.fire({
        title: 'Login',
        html:
            '<input id="swal-input1" class="swal2-input" placeholder="Username">' +
            '<input id="swal-input2" class="swal2-input" placeholder="Password" type="password">',
        focusConfirm: false,
        preConfirm: () => {
            const username = document.getElementById('swal-input1').value;
            const password = document.getElementById('swal-input2').value;
            if (!username || !password) {
                Swal.showValidationMessage('Please enter a username and password');
            } else
                return {
                    username,
                    password,
                };
        },
        footer: '<a href="javascript:hcdb.register()">Register</a>',
    });

    if (formValues) {
        const req = await submitWithAlert('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formValues),
        });

        if (req) {
            const json = await req.json();
            localStorage.setItem('token', json.token);
            await updateAccountSpan();
        }
    }
};

window.hcdb.register = async () => {
    const { value: formValues } = await Swal.fire({
        title: 'Register',
        html:
            '<input id="swal-input1" class="swal2-input" placeholder="Username">' +
            '<input id="swal-input2" class="swal2-input" placeholder="Password" type="password">',
        focusConfirm: false,
        preConfirm: () => {
            const username = document.getElementById('swal-input1').value;
            const password = document.getElementById('swal-input2').value;
            if (!username || !password) {
                Swal.showValidationMessage('Please enter a username and password');
            } else
                return {
                    username,
                    password,
                };
        },
        footer: '<a href="javascript:hcdb.login()">Login</a>',
    });

    if (formValues) {
        const req = await submitWithAlert('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formValues),
        });

        if (req) {
            const json = await req.json();
            localStorage.setItem('token', json.token);
            await updateAccountSpan();
        }
    }
};

window.hcdb.logout = async () => {
    const confirm = await Swal.fire({
        title: 'Are you sure you want to logout?',
        showDenyButton: true,
        showCancelButton: false,
        confirmButtonText: 'Yes',
        denyButtonText: 'No',
        icon: 'question',
    });

    if (confirm.value) {
        localStorage.removeItem('token');
        await updateAccountSpan();
    }
};

window.hcdb.welcome = async () => {
    const tutorialPrompt = Swal.mixin({
        confirmButtonText: 'Next &rarr;',
        showCancelButton: true,
        allowOutsideClick: false,
        cancelButtonText: 'Skip',
        progressSteps: ['1', '2', '3', '4', '5', '6'],
    });

    const tutorialSteps = [
        {
            title: 'Welcome to the Halloween Candy Database!',
            text: 'This is a database of all the houses in Lethbridge that give out candy on Halloween. You can add houses, rate houses, and more!',
        },
        {
            title: 'Navigating the map',
            text: 'The map will show a radar around you, and all the houses in that radar. Houses with different colours mean different things.',
        },
        {
            title: 'House Colours',
            html: `Houses have different colours to mean different things.
            <br/>Houses that are a light grey, are not houses you can interact with (such as businesses, or out of your range).
            <br/>Houses that are a darker grey, mean they don't have data on them yet. Be the first to add them!
            <br/>Black coloured houses are houses that do not give out candy, for one reason or another.
            <br/>Coloured houses are ones that have been rated by other users. They range from red to green, with red being the worst and green being the best.
            <img src="${imgs.colours}" style="width: 100%; height: auto;"/>`,
        },
        {
            title: 'House details',
            html: `Clicking on a house will show you more details about it. You can view what other people rated it as, and rate it yourself!
            <img src="${imgs.popup}" style="width: 100%; height: auto;"/>`,
        },
        {
            title: 'Adding a house',
            text: 'Clicking on the "submit a report" button will allow you to add a house to the database. You will be prompted details about the house, and then you can submit it!',
        },
        {
            title: 'Account',
            text: 'On the header, there will be a login and register button. Here you can make an account, which is necessary to submit reports. Once logged in, you can log out by clicking on your username.',
        },
    ];

    await tutorialPrompt.queue(tutorialSteps);

    console.log('done');

    localStorage.setItem('welcome', 'true');

};


let manualControls;
const setManual = async (mode) => {
    manualControls.hidden = !mode;
};

let marker;
let displayPolygon;
let displayCircle;
let displaySvg;
let storedHomes;

const svgElement = document.createElement('svg');
svgElement.setAttribute('viewBox', '0 0 200 200');
svgElement.onanimationstart = (evt) => {
    console.log('animation start');
    const animation = evt.target.getAnimations()[0];
    animation.startTime = 0;
};
svgElement.innerHTML = `<svg viewbox="0 0 200 200" class="radar">
    <defs>
        <lineargradient id="Radar" x1="0" x2="1" y1="0" y2="1">
            <stop stop-color="green" offset="0%"></stop>
            <stop stop-color="transparent" offset="100%"></stop>
        </lineargradient>
    </defs>
    <path d="M 100 0
           l 0 100
           l 25 -96" style="fill: url(#Radar);"></path>

    <circle cx="100" cy="100" stroke="black" fill="transparent" stroke-width="2" stroke-opacity="1" r="99"></circle>

</svg>`;

const displayInCircle = async () => {
    if(!displayCircle) return;
    // Only find the homes in the displayCircle
    const homesInCircle = storedHomes.filter((home) => {
        const coords = new L.LatLng(home.geometry.coordinates[0][0][0], home.geometry.coordinates[0][0][1]);
        if (coords.distanceTo(marker.getLatLng()) < 450)
            return true;
        return false;
    });


    await displayHomesInBounds(homesInCircle);
};

const updatePosition = async (pos) => {
    console.log(pos);

    if (marker)
        map.removeLayer(marker);
    else
        map.setView([pos.coords.latitude, pos.coords.longitude], 16);

    marker = L.marker([pos.coords.latitude, pos.coords.longitude]).addTo(map);

    if (displayCircle)
        map.removeLayer(displayCircle);

    displayCircle = L.circle([pos.coords.latitude, pos.coords.longitude], {
        color: 'transparent',
        radius: 500,
    }).addTo(map);

    if (displaySvg)
        map.removeLayer(displaySvg);


    const svgElementBounds = displayCircle.getBounds();
    displaySvg = L.svgOverlay(svgElement, svgElementBounds).addTo(map);

    let shouldUpdate = false;
    if (displayPolygon) {
        // Check if the circle's bounds are inside the polygon's
        const polygonBounds = displayPolygon.getBounds();
        if (polygonBounds.contains(svgElementBounds)) {
            console.log('inside');
        }
        else {
            console.log('outside');
            shouldUpdate = true;
        }
    }
    else shouldUpdate = true;


    let homes;
    if (shouldUpdate) {
        if (displayPolygon)
            map.removeLayer(displayPolygon);

        const nwLat = pos.coords.latitude + 0.01;
        const nwLng = pos.coords.longitude - 0.015;
        const seLat = pos.coords.latitude - 0.01;
        const seLng = pos.coords.longitude + 0.015;

        displayPolygon = L.polygon([
            [nwLat, nwLng],
            [nwLat, seLng],
            [seLat, seLng],
            [seLat, nwLng],
        ], {
            color: 'transparent',
        }).addTo(map);

        displayPolygon.bringToBack();
        displaySvg.bringToBack();

        homes = await getHomeInBounds({ lat: nwLat, lng: nwLng }, { lat: seLat, lng: seLng });

        storedHomes = homes;
    } 

    await displayInCircle();

};


const runLocation = async () => {
    const permission = await navigator.permissions?.query({ name: 'geolocation' });
    if (!permission || permission.state === 'prompt')
        return new Promise((resolve, reject) => {
            let resolved = false;

            navigator.geolocation.watchPosition((pos) => {
                updatePosition(pos);
                if (!resolved) {
                    Swal.close();
                    resolve();
                    resolved = true;
                    window.localStorage.setItem('allowLocation', true);
                }
            }, (err) => {
                console.error(err);
                reject();
                setManual(true);
                if (err.message.toLowerCase().includes('user denied')) {
                    window.localStorage.setItem('allowLocation', true);
                    // send toast
                    Swal.fire({
                        title: 'Location access denied',
                        text: 'For the best experience, please allow location access',
                        icon: 'error',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000,
                        timerProgressBar: true,
                        didOpen: (toast) => {
                            toast.addEventListener('mouseenter', Swal.stopTimer);
                            toast.addEventListener('mouseleave', Swal.resumeTimer);
                        }

                    });
                }
                else
                    Swal.fire({
                        title: 'Error',
                        text: 'There was an error getting your location. Please try again.\n' + err.message,
                        icon: 'error',
                    });
            }, {
                enableHighAccuracy: true
            });
        });
    if (permission.state === 'granted') {
        navigator.geolocation.watchPosition(updatePosition, undefined, {
            enableHighAccuracy: true,
        });
    }
    else if (permission.state === 'denied') {
        Swal.fire({
            title: 'Location access denied',
            text: 'For the best experience, please allow location access',
            icon: 'error',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });
        throw undefined;
    }
};

const setupLocation = async () => {
    const permission = await navigator.permissions?.query({ name: 'geolocation' });
    if (!permission || permission.state === 'prompt') {
        if (window.localStorage.getItem('allowLocation') !== 'true')
            await Swal.fire({
                title: 'Location',
                text: 'We need to know your location to show you houses in your area.',
                icon: 'info',
                showCancelButton: false,
                showConfirmButton: true,
                confirmButtonText: 'Continue',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showLoaderOnConfirm: true,
                preConfirm: runLocation,
            });
        else await runLocation();
    } else {
        await runLocation();
    }

};

window.hcdb.updateLoadedHome = async (homeId) => {
    const homeIndex = storedHomes.findIndex((home) => home.id === homeId);
    if (homeIndex === -1) return;

    const newHome = await getHome(homeId);
    storedHomes[homeIndex] = newHome;

    await displayInCircle();
};


// Wait for dom to load
document.addEventListener('DOMContentLoaded', async () => {
    map = L.map('map').setView([49.6945782, -112.8331033], 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: 'Map Data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Handlers

    const randomHomeButton = document.getElementById('random-home');
    const homeIdInput = document.getElementById('home-id');
    const homeIdButton = document.getElementById('home-id-button');
    const homesInBoundsButton = document.getElementById('inbound-homes');
    const positionButton = document.getElementById('position-button');

    manualControls = document.getElementById('manual');

    accountSpan = document.getElementById('account');

    randomHomeButton.addEventListener('click', async () => {
        const home = await displayRandomHome();

        if (!home) alert('No home found');
    });

    homeIdButton.addEventListener('click', async () => {
        const home = await displaySpecificHome(homeIdInput.value);

        if (!home) alert(`No home found with id ${homeIdInput.value}`);
    });

    homesInBoundsButton.addEventListener('click', async () => {
        const zoom = map.getZoom();
        if (zoom < 15) {
            const ok = confirm('Loading this many houses at once may take a while. Are you sure you want to continue?');
            if (!ok) return;
        }
        await displayHomesInBounds();
    });

    positionButton.addEventListener('click', async () => {
        const center = map.getCenter();
        await updatePosition({
            coords: {
                latitude: center.lat,
                longitude: center.lng,

            }
        });
    });

    await updateAccountSpan();

    if(window.localStorage.getItem('welcome') !== 'true') {
        await window.hcdb.welcome();
    }

    await setupLocation().catch(() => {
        setManual(true);
    });
});
