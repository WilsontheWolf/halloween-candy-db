# Halloween Candy DB

This is a project made for the 2022 University of Lethbridge Hack'o'Ween.
The goal is to be a database of Halloween candy, with the ability to add, edit, and delete entries.

## Docker
This project has a docker image to pull. Theres a bit of setup though.

### Setup
You can pull the image with the following command:
```bash
docker pull ghcr.io/wilsonthewolf/halloween-candy-db:latest
```

Next you need to setup the map data. This is done by running the following command:
```bash
docker run -it --rm -v $(pwd)/data:/app/data ghcr.io/wilsonthewolf/halloween-candy-db:latest sh -c 'node src/download.js && node src/process.js'
```

This will download building data from [OpenStreetMaps](https://www.openstreetmap.org/) and process it.

Optionally, you can pass a relationship id of a city acquired from https://nominatim.openstreetmap.org to download the data for that city. For example, the relationship id for Lethbridge is 4163076 (also the default), so you can run the following command to download the data for Lethbridge:
```bash
docker run -it --rm -v $(pwd)/data:/app/data ghcr.io/wilsonthewolf/halloween-candy-db:latest sh -c 'node src/download.js 4163076 && node src/process.js'
```

### Running
Finally, you can run the server using the `docker-compose.yml` file or by running the following command:
```bash
docker run -it --rm -p 3000:3000 -v $(pwd)/data:/app/data ghcr.io/wilsonthewolf/halloween-candy-db:latest
```

## Running Locally
### Setup
First make sure you have node.js v16.x or higher installed. Then run the following commands:
```sh
npm install # or yarn install
npm run setup # or yarn setup
```

This will download building data from [OpenStreetMaps](https://www.openstreetmap.org/), and process homes.

Once this is done, you may continue to running the server.

### Running

To run the server, run the following command:
```sh
npm run start # or yarn start
```

This will start the server on port 3000. You can change this by setting the `PORT` environment variable.