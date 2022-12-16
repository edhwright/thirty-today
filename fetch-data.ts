import { writeJSON } from "https://deno.land/x/flat@0.0.15/mod.ts";
import { group } from "https://cdn.skypack.dev/pin/d3-array@v3.2.1-hGTrvmvXYXil9KElf3uD/mode=imports,min/optimized/d3-array.js";
import dayjs from "https://cdn.skypack.dev/pin/dayjs@v1.11.6-77Jm7cE3hNuQn3XDVXyF/mode=imports,min/optimized/dayjs.js";

const [GUARDIAN_KEY, NYTIMES_KEY, METEOSTAT_KEY] = Deno.args;

const from_date = dayjs().subtract(30, "year").subtract(1, "day");
const to_date = dayjs().subtract(30, "year").add(1, "day");

const data = await fetch_data();
await writeJSON("./data.json", data);

async function fetch_data() {
  let data: Map<string, { guardian_articles: Article[]; nytimes_articles: Article[]; wiki_events: Event[]; weather: Weather[] }> = new Map();

  const guardian_articles = await fetch_guardian_articles(from_date.format("YYYY-MM-DD"), to_date.format("YYYY-MM-DD"));
  const guardian_articles_by_date: Map<string, Article[]> = group(guardian_articles, (a: Article) => a.date);

  const nytimes_articles = await fetch_nytimes_articles(from_date.format("YYYYMMDD"), to_date.format("YYYYMMDD"));
  const nytimes_articles_by_date: Map<string, Article[]> = group(nytimes_articles, (a: Article) => a.date);

  const wiki_events = await fetch_wiki_events(from_date.format("YYYY-MM-DD"), to_date.format("YYYY-MM-DD"));
  const wiki_events_by_date: Map<string, Event[]> = group(wiki_events, (e: Event) => e.date);

  const weather = await fetch_weather(from_date.format("YYYY-MM-DD"), to_date.format("YYYY-MM-DD"));
  const weather_by_date: Map<string, Weather[]> = group(weather, (w: Weather) => w.date);

  add_date_data(from_date.format("YYYYMMDD"));
  add_date_data(from_date.add(1, "day").format("YYYYMMDD"));
  add_date_data(to_date.format("YYYYMMDD"));

  function add_date_data(date: string) {
    data.set(date, {
      guardian_articles: guardian_articles_by_date.has(date) ? guardian_articles_by_date.get(date) : [],
      nytimes_articles: nytimes_articles_by_date.has(date) ? nytimes_articles_by_date.get(date) : [],
      wiki_events: wiki_events_by_date.has(date) ? wiki_events_by_date.get(date) : [],
      weather: weather_by_date.has(date) ? weather_by_date.get(date) : [],
    });
  }

  return Object.fromEntries(data);
}

async function fetch_guardian_articles(from_date: string, to_date: string): Promise<Article[]> {
  let page = 1;
  let has_fetched_all_articles = false;
  let guardian_articles: Article[] = [];

  while (!has_fetched_all_articles && page < 20) {
    const guardian_data_res = await fetch(`https://content.guardianapis.com/search?api-key=${GUARDIAN_KEY}&from-date=${from_date}&to-date=${to_date}&page=${page}&page-size=50`);
    if (!guardian_data_res.ok) {
      console.log(`${guardian_data_res.status}: Guardian (page ${page}) failed to fetch: ${await guardian_data_res.text()}`);
      await delay(6000);
      page++;
    } else {
      const guardian_data = await guardian_data_res.json();
      guardian_articles = [
        ...guardian_articles,
        ...guardian_data.response.results.map((article) => ({
          date: dayjs(article.webPublicationDate).format("YYYYMMDD"),
          headline: article.webTitle,
          web_url: article.webUrl,
          abstract: null,
          thumbnail: null,
          section: article.pillarName,
          subsection: article.sectionName
        })),
      ];

      if (page < guardian_data.response.pages) {
        await delay(6000);
        page++;
      } else {
        has_fetched_all_articles = true;
      }
    }
  }

  return guardian_articles;
}

async function fetch_nytimes_articles(from_date: string, to_date: string): Promise<Article[]> {
  let page = 1;
  let has_fetched_all_articles = false;
  let nytimes_articles: Article[] = [];
  
  while (!has_fetched_all_articles && page < 100) {
    const nytimes_data_res = await fetch(`https://api.nytimes.com/svc/search/v2/articlesearch.json?api-key=${NYTIMES_KEY}&begin_date=${from_date}&end_date=${to_date}&page=${page}&fq=section_name:("Arts" "Automobiles" "Autos" "Blogs" "Books" "Business" "Education" "Front Page" "Giving" "Health" "Job Market" "Movies" "Multimedia" "National" "New York" "Olympics" "Opinion" "Public Editor" "Real Estate" "Science" "Sports" "Style" "Sunday Magazine" "Sunday Review" "Technology" "The Public Editor"  "Theater" "Today's Headlines" "Travel" "U.S." "Washington" "World" "Your Money")`);
    if (!nytimes_data_res.ok) {
      console.log(`${nytimes_data_res.status}: New York Times (page ${page}) failed to fetch: ${await nytimes_data_res.text()}`);
      await delay(6000);
      page++;
    } else {
      const nytimes_data = await nytimes_data_res.json();
      nytimes_articles = [
        ...nytimes_articles,
        ...nytimes_data.response.docs.map((article) => ({
          date: dayjs(article.pub_date).format("YYYYMMDD"),
          headline: article.headline.main,
          web_url: article.web_url,
          abstract: article.abstract,
          thumbnail:
            article.multimedia.length > 1 && article.multimedia[0].type === "image"
              ? {
                  thumbnail_url: `https://nytimes.com/${article.multimedia[0].url}`,
                  thumbnail_width: article.multimedia[0].width,
                  thumbnail_height: article.multimedia[0].height,
                }
              : null,
          section: article.section_name,
          subsection: article.subsection_name
        })),
      ];

      if (nytimes_data.response.meta.offset < nytimes_data.response.meta.hits) {
        await delay(6000);
        page++;
      } else {
        has_fetched_all_articles = true;
      }
    }
  }

  return nytimes_articles;
}

async function fetch_wiki_events(from_date: string, to_date: string): Promise<Event[]> {
  let wiki_events: Event[] = [];

  await fetch_date_data(dayjs(from_date).format("YYYY-MM-DD"));
  await delay(6000);
  await fetch_date_data(dayjs(from_date).add(1, "day").format("YYYY-MM-DD"));
  await delay(6000);
  await fetch_date_data(dayjs(to_date).format("YYYY-MM-DD"));

  async function fetch_date_data(date: string) {
    const wiki_data_res = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${dayjs(date).format("MM/DD")}`);
    if (!wiki_data_res.ok) {
      console.log(`${wiki_data_res.status}: Wikimedia (${dayjs(date).format("MM/DD")}) failed to fetch: ${await wiki_data_res.text()}`);
    } else {
      const wiki_data = await wiki_data_res.json();
      const filtered_wiki_data = wiki_data.events.filter((event) => event.year === parseInt(dayjs(date).format("YYYY")));
      wiki_events = [
        ...wiki_events,
        ...filtered_wiki_data.map((event) => ({
          date: dayjs(date).format("YYYYMMDD"),
          headline: event.text,
          pages: event.pages.map((page) => ({
            title: page.titles.normalized,
            web_url: page.content_urls.desktop.page,
            description: page.description,
            thumbnail: page.hasOwnProperty("thumbnail")
              ? {
                  thumbnail_url: page.thumbnail.source,
                  thumbnail_width: page.thumbnail.width,
                  thumbnail_height: page.thumbnail.height,
                }
              : null,
            abstract: page.extract,
          })),
        })),
      ];
    }
  }

  return wiki_events;
}

async function fetch_weather(from_date: string, to_date: string): Promise<Weather[]> {
  const london_location = { name: "London", lon: -0.118092, lat: 51.509865 };
  const ny_location = { name: "New York", lon: -73.935242, lat: 40.73061 };

  let weather: Weather[] = [];

  await fetch_location_data(london_location);
  await delay(6000);
  await fetch_location_data(ny_location);

  async function fetch_location_data(location: { name: string; lon: number; lat: number }) {
    const weather_data_res = await fetch(`https://meteostat.p.rapidapi.com/point/hourly?lat=${location.lat}&lon=${location.lon}&start=${from_date}&end=${to_date}&rapidapi-key=${METEOSTAT_KEY}`);
    if (!weather_data_res.ok) {
      console.log(`${weather_data_res.status}: Meteostat (${location.name}) failed to fetch: ${await weather_data_res.text()}`);
    } else {
      const weather_data = await weather_data_res.json();
      weather = [
        ...weather,
        ...weather_data.data.map((hour) => ({
          date: dayjs(hour.time).format("YYYYMMDD"),
          time: hour.time,
          location: location,
          temp: hour.temp,
          rhum: hour.rhum,
          wspd: hour.wspd,
        })),
      ];
    }
  }

  return weather;
}

interface Article {
  date: string;
  headline: string;
  web_url: string;
  abstract: string | null;
  thumbnail: {
    thumbnail_url: string;
    thumbnail_width: number;
    thumbnail_height: number;
  } | null;
  section: string;
  subsection: string;
}

interface Event {
  date: string;
  headline: string;
  pages: {
    title: string;
    description: string;
    thumbnail: {
      thumbnail_url: string;
      thumbnail_width: string;
      thumbnail_height: string;
    } | null;
    abstract: string;
  }[];
}

interface Weather {
  date: string;
  time: string;
  location: {
    name: string;
    lon: number;
    lat: number;
  };
  temp: number;
  rhum: number;
  wspd: number;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
