# Halloween Candy DB

This is a project made for the 2022 University of Lethbridge Hack'o'Ween.
The goal is to be a database of Halloween candy, with the ability to add, edit, and delete entries.

## Setup
First make sure you have node.js v16.x or higher installed. Then run the following commands:
```sh
npm install # or yarn install
npm run setup # or yarn setup
```

This will download building data from [OpenStreetMaps](https://www.openstreetmap.org/), and process homes.

Once this is done, you may continue to running the server.

# Running the server
To run the server, run the following command:
```sh
npm run start # or yarn start
```

This will start the server on port 3000. You can change this by setting the `PORT` environment variable.