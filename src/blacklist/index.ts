import blacklist_akamai_servers from "./akamai";
import blacklist_google_ads from "./google";
import blacklist_spotify_servers from "./spotify";

const blacklist = [
	...blacklist_google_ads,
	...blacklist_spotify_servers,
	...blacklist_akamai_servers,
];

export default blacklist;
export { blacklist };
