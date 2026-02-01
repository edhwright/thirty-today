/** @jsx h */
import page_data from "./data.json" assert { type: "json" };
import { serve } from "https://deno.land/std@0.155.0/http/server.ts";
import { h, html } from "https://deno.land/x/htm@0.0.10/mod.tsx";
import { UnoCSS } from "https://deno.land/x/htm@0.0.10/plugins.ts";
import { group } from "https://esm.sh/d3-array@3.2.1";
import dayjs from "https://esm.sh/dayjs@1.11.7";
import utc from "https://esm.sh/dayjs@1.11.7/plugin/utc";
import timezone from "https://esm.sh/dayjs@1.11.7/plugin/timezone";
import advanced from "https://esm.sh/dayjs@1.11.7/plugin/advancedFormat";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advanced);

// uses https://github.com/ije/html
html.use(UnoCSS());

const handler = async (req: Request, context) => {
  const ip = (context.remoteAddr as Deno.NetAddr).hostname;
  const location_data = await fetch("http://ip-api.com/json/" + ip).then((d) =>
    d.json()
  );

  return html({
    lang: "en",
    title: "thirty-today",
    meta: {
      description: "News from 30 years ago.",
    },
    links: [
      {
        rel: "icon",
        href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ctext y='22' x='0' font-size='22'%3E🗞️%3C/text%3E%3C/svg%3E",
      },
    ],
    styles: [
      `
      html, body { height: 100%; }
      body { background-color: #dcd7d0; font-family: Helvetica, "Helvetica Neue", Frutiger, "Frutiger Linotype", Univers, Calibri, "Gill Sans", "Gill Sans MT", "Myriad Pro", Myriad, "DejaVu Sans Condensed", "Liberation Sans", "Nimbus Sans L", Tahoma, Geneva, Arial, sans-serif }
      details > summary::-webkit-details-marker { display: none; }
      .line-clamp { display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
	  .bg-beige { background-color: #dcd7d0; }
	  .text-beige { color: #dcd7d0; }  
      `,
    ],
    body: (
      <div class="w-full h-full text-dark bg-beige">
        <header class="p-x-2 md:p-x-3 p-y-2 bg-dark text-beige">
          <h1>
            {dayjs()
              .tz(location_data.timezone)
              .subtract(30, "year")
              .format("dddd, D MMMM, YYYY")}
          </h1>
        </header>
        <main>
          <hr />
          <Events
            user_timezone={location_data.timezone}
            page_data={page_data}
          />
          <Country
            country={{
              name: "United States",
              timezone: "America/New_York",
              publication: {
                name: "The New York Times",
                key: "nytimes_articles",
              },
              weather_location: "New York",
            }}
            user_timezone={location_data.timezone}
            page_data={page_data}
          />
          <Country
            country={{
              name: "United Kingdom",
              timezone: "Europe/London",
              publication: { name: "The Guardian", key: "guardian_articles" },
              weather_location: "London",
            }}
            user_timezone={location_data.timezone}
            page_data={page_data}
          />
        </main>
        <footer class="p-x-2 md:p-x-3 p-y-5">
          <p class="text-sm underline">
            <a href="https://github.com/edhwright/thirty-today" target="_blank">
              GitHub
            </a>
          </p>
        </footer>
      </div>
    ),
  });
};

serve(handler);

interface EventsProps {
  user_timezone: string;
  page_data: PageData;
}

function Events(props: EventsProps) {
  const dayjs_date = dayjs().tz(props.user_timezone).subtract(30, "year");
  const events = props.page_data[dayjs_date.format("YYYYMMDD")].wiki_events;

  if (events.length === 0) {
    return;
  }

  return (
    <div class="bg-dark text-beige">
      {events.map((event) => (
        <section class="max-w-6xl p-y-4">
          <h2 class="text-lg p-x-2 md:p-x-3 m-b-3">{event.headline}</h2>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-1 sm:p-x-1">
            {event.pages.map((page) => (
              <a
                class="p-2 flex flex-col justify-between cursor-pointer hover-bg-op-30 hover-bg-dark-1"
                href={page.web_url}
                target="_blank"
              >
                <header class="m-b-3">
                  <h3 class="text-sm m-b-2">{page.title}</h3>
                  {page.thumbnail ? (
                    <img
                      class="w-full max-h-72 object-contain"
                      src={page.thumbnail.thumbnail_url}
                      width={page.thumbnail.thumbnail_width}
                      height={page.thumbnail.thumbnail_height}
                      alt="thumbnail"
                      loading="lazy"
                    />
                  ) : (
                    <img
                      class="w-full max-h-52 object-contain"
                      src="https://upload.wikimedia.org/wikipedia/en/thumb/8/80/Wikipedia-logo-v2.svg/842px-Wikipedia-logo-v2.svg.png"
                      width="842"
                      height="768"
                      alt="thumbnail"
                      loading="lazy"
                    />
                  )}
                </header>
                <p class="line-clamp text-sm">{page.abstract}</p>
              </a>
            ))}
          </div>
        </section>
      ))}
      <hr />
    </div>
  );
}

interface CountryProps {
  country: {
    name: "United Kingdom" | "United States";
    timezone: "Europe/London" | "America/New_York";
    publication: {
      name: "The Guardian" | "The New York Times";
      key: "guardian_articles" | "nytimes_articles";
    };
    weather_location: "London" | "New York";
  };
  user_timezone: string;
  page_data: PageData;
}

function Country(props: CountryProps) {
  const dayjs_date = dayjs()
    .tz(props.user_timezone)
    .subtract(30, "year")
    .tz(props.country.timezone);

  const weather = props.page_data[dayjs_date.format("YYYYMMDD")].weather.find(
    (w: Weather) =>
      w.location.name === props.country.weather_location &&
      w.time === dayjs_date.format("YYYY-MM-DD HH:00:00")
  );
  const articles =
    props.page_data[dayjs_date.format("YYYYMMDD")][
      props.country.publication.key
    ];

  if (articles.length === 0) {
    return;
  }

  const articles_by_section: Map<string, Article[]> = group(
    articles,
    (a: Article) => a.section
  );

  return (
    <div>
      <section class="max-w-6xl sm:grid grid-cols-5 gap-1 p-y-4 sm:p-x-1">
        <header class="p-l-2 m-b-4 sm:m-b-0">
          <h2 class="text-lg m-b-2">{props.country.name}</h2>
          <div class="text-sm sm:p-t-3 m-b-2">
            <p>{dayjs_date.format("HH:mm (z)")}</p>
            <p>{dayjs_date.format("D MMMM, YYYY")}</p>
          </div>
          {weather !== undefined && (
            <div class="text-sm">
              <p>{props.country.weather_location}</p>
              <p>{weather.temp} °C</p>
              <p>Humidity: {weather.rhum}%</p>
              <p>Wind: {weather.wspd} km/h</p>
            </div>
          )}
        </header>
        <section class="col-span-4 sm:p-l-2">
          <h3 class="text-lg m-b-2 p-l-2 sm:p-l-0">
            {props.country.publication.name}
          </h3>
          {[...articles_by_section.keys()].sort().map((section) => {
            // Remove duplicates based on headline
            const sectionArticles = articles_by_section.get(section);
            const uniqueArticles = Array.from(
              new Map(sectionArticles.map(article => [article.headline, article])).values()
            );
            
            // Sort: articles with abstracts first, then alphabetically within each group
            const sortedArticles = uniqueArticles.sort((a, b) => {
              const aHasAbstract = !!a.abstract;
              const bHasAbstract = !!b.abstract;
              
              if (aHasAbstract && !bHasAbstract) return -1;
              if (!aHasAbstract && bHasAbstract) return 1;
              return a.headline.localeCompare(b.headline);
            });
            
            // Split into two groups
            const withAbstract = sortedArticles.filter(a => a.abstract);
            const withoutAbstract = sortedArticles.filter(a => !a.abstract);
            
            return (
              <section class="sm:grid grid-cols-8 gap-1">
                <h4 class="text-base m-t-3 m-b-2 sm:m-y-1 sm:p-y-2 max-w-max sm:text-sm border-b-2 border-dark sm:border-0 m-l-2 sm:m-l-0">
                  {section}
                </h4>
                <div class="col-span-7">
                  {withAbstract.map((article) => (
                    <details class="m-y-1 open-bg-op-10 open-bg-dark-1">
                      <summary class="p-2 text-sm list-none cursor-pointer hover-bg-op-10 hover-bg-dark-1">
                        {article.headline}
                      </summary>
                      <div class="p-2">
                        {article.abstract && (
                          <p class="m-b-2 text-base">{article.abstract}</p>
                        )}
                        {article.thumbnail && (
                          <img
                            class="m-b-2"
                            src={article.thumbnail.thumbnail_url}
                            width={article.thumbnail.thumbnail_width}
                            height={article.thumbnail.thumbnail_height}
                            alt="thumbnail"
                          />
                        )}
                        <p class="text-sm underline">
                          <a href={article.web_url} target="_blank">
                            Full article
                          </a>
                        </p>
                      </div>
                    </details>
                  ))}
                  {withAbstract.length > 0 && withoutAbstract.length > 0 && (
                    <hr class="m-y-2 opacity-30" />
                  )}
                  {withoutAbstract.map((article) => (
                    <details class="m-y-1 open-bg-op-10 open-bg-dark-1">
                      <summary class="p-2 text-sm list-none cursor-pointer hover-bg-op-10 hover-bg-dark-1">
                        {article.headline}
                      </summary>
                      <div class="p-2">
                        {article.thumbnail && (
                          <img
                            class="m-b-2"
                            src={article.thumbnail.thumbnail_url}
                            width={article.thumbnail.thumbnail_width}
                            height={article.thumbnail.thumbnail_height}
                            alt="thumbnail"
                          />
                        )}
                        <p class="text-sm underline">
                          <a href={article.web_url} target="_blank">
                            Full article
                          </a>
                        </p>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            );
          })}
        </section>
      </section>
      <hr />
    </div>
  );
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
    web_url: string;
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

interface PageData {
  [year: string]: {
    guardian_articles: Article[];
    nytimes_articles: Article[];
    wiki_events: Event[];
    weather: Weather[];
  };
}