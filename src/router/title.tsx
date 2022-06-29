import { css, keyframes } from '@emotion/react'
import { useEffect, useState } from 'react'
import { Link, navigate } from 'raviger'
import * as N from 'fp-ts/number'
import * as R from 'fp-ts/lib/Record'
import { pipe } from 'fp-ts/function'
import { reverse, contramap } from 'fp-ts/ord'
import * as A from 'fp-ts/lib/Array'
import { groupBy, NonEmptyArray } from 'fp-ts/NonEmptyArray'
import { mergeMap } from 'rxjs/operators'
import { filter, from, map, shareReplay } from 'rxjs'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnet } from '@fortawesome/free-solid-svg-icons'
import { ChevronDown, ChevronUp, Heart } from 'react-feather'

import { getRoutePath, Route } from './path'
import { getSeries, searchTitles, TitleHandle } from '../../../../scannarr/src'
import { diceCompare } from '../utils/string'
import { useObservable } from '../utils/use-observable'
import { getHumanReadableByteString } from '../utils/bytes'
import { cachedDelayedFetch } from '../utils/fetch'
import Sources from '../components/sources'
import Input from '../components/inputs'
import { sort } from 'fp-ts/lib/ReadonlyArray'
import { toUndefined } from 'fp-ts/lib/Option'

const placeHolderShimmer = keyframes`
  0%{
      background-position: -468px 0;
  }
  100%{
      background-position: 468px 0;
  }
`

const style = css`
  display: grid;
  grid-template-columns: 40rem 1fr;
  grid-template-rows: 50rem 1fr;
  padding: 10rem;
  padding-bottom: 5rem;

  .title-placeholder {
    height: 3.2rem;
    width: 45rem;
  }

  .gradient {
    animation-duration: 1.8s;
    animation-fill-mode: forwards;
    animation-iteration-count: infinite;
    animation-name: ${placeHolderShimmer};
    animation-timing-function: linear;
    background: #f6f7f8;
    /* background: linear-gradient(to right, #222222 8%, #323232 38%, #222222 54%); */
    background: linear-gradient(to right, #1c1c1c 8%, #272727 38%, #1c1c1c 54%);
    background-size: 1000px 640px;
    
    position: relative;
  }

  .poster {
    height: 100%;
  }

  .score {
    display: flex;
    justify-content: space-around;
    align-items: center;
    svg {
      margin-left: 0.5rem;
      color: hsl(338,73%,60%);
    }
  }

  .series {
    .title-bar {
      display: flex;
      gap: 2rem;
      align-items: baseline;
      margin-bottom: 2.5rem;

      h1 {
      }

      h2 {
        color: #777777;
      }
    }

    .data {
      display: flex;
      align-items: end;
      margin-bottom: 2.5rem;
      padding-bottom: 1rem;
      border-bottom: 0.1rem solid rgb(75, 75, 75);
      column-gap: 2rem;

      .sources {
        display: grid;
        grid-template-columns: repeat(auto-fill, 3.2rem);
        height: 3.2rem;
      }

      .date {
        font-weight: 500;
      }
    }

    .synopsis {
      font-weight: 500;
      line-height: 2.5rem;
      white-space: pre-wrap;
      padding-bottom: 1rem;
      border-bottom: 0.1rem solid rgb(75, 75, 75);
    }
  }

  .titles {
    grid-column: 1 / 3;

    display: grid;
    grid-template-columns: 1fr 1fr;

    .list {
      display: grid;
      grid-auto-rows: 7.5rem;
      grid-gap: 1rem;
      padding-left: 10rem;
      margin-right: 10rem;
      margin-top: 5rem;
      max-height: 85rem;
      overflow-y: auto;

      .title {
        display: flex;
        align-items: center;
        padding: 2.5rem;
        background-color: rgb(35, 35, 35);
        cursor: pointer;
        color: #fff;

        &:hover {
          background-color: rgb(42, 42, 42);
        }

        .name {
          display: flex;
          gap: 2rem;

          .main {}
          .secondary {
            color: #777777;
          }
        }

        &:hover {
          text-decoration: none;
        }

        &.selected {
          background-color: rgb(75, 75, 75);
        }

        .number {
          display: inline-block;
          width: 5rem;
        }
        .data {
          display: grid;
          grid-template-columns: auto 1fr;
          margin-left: auto;

          .date {
            margin-left: 2rem;
            min-width: 10rem;
          }
        }
      }
    }

    .title-info {
      display: flex;
      flex-direction: column;
      height: 90rem;
      background-color: rgb(35, 35, 35);
      padding: 2.5rem;

      .title {
        display: flex;
        gap: 2rem;
        /* display: grid;
        grid-auto-flow: column; */
        /* grid-template-columns: fit-content(100%) auto; */
        /* grid-gap: 1rem; */
        align-items: baseline;
        margin-bottom: 2.5rem;
        padding-bottom: 1rem;
        border-bottom: 0.1rem solid rgb(75, 75, 75);

        h3 {
          color: #777777;
        }
      }

      .synopsis {
        font-weight: 500;
        line-height: 2.5rem;
        white-space: pre-wrap;
        padding-bottom: 1rem;
        border-bottom: 0.1rem solid rgb(75, 75, 75);
      }

      .search-override {
        margin: 2rem;
        width: 40rem;
      }

      .resolutions {
        display: grid;
        grid-auto-flow: column;
        grid-gap: 1rem;

        span {
          cursor: pointer;
          padding: 1rem;
          text-align: center;
          border: 0.1rem solid rgb(75, 75, 75);
          &:hover {
            background-color: rgb(42, 42, 42);
          }
        }
        span.selected {
          background-color: rgb(75, 75, 75);
        }
      }

      .sources {
        display: grid;
        /* grid-template-columns: 1fr 1fr; */
        grid-template-columns: 1fr 1fr;
        margin-top: 4rem;
        column-gap: 2rem;
        row-gap: 1rem;

        .source {
          position: relative;
          display: flex;
          align-items:center;
          /* height: 3.2rem; */
          margin: 0.5rem 0;
          padding: 1rem;
          border: 0.1rem solid rgb(75, 75, 75);

          &:hover {
            background-color: rgb(42, 42, 42);
          }

          .backlink {
            position: absolute;
            inset: 0;
            padding: inherit;
            box-sizing: content-box;
            z-index: 50;
          }

          a {
            z-index: 100;
          }

          .team {
            display: flex;
            align-items: center;
            height: 3.2rem;
            color: #fff;
            margin-right: 1rem;
          }

          .team-icon {
            height: 3.2rem;
            width: 3.2rem;
            margin-left: 0.5rem;
            margin-right: 0.5rem;
          }

          .name {
            margin: auto;
          }

          .info {
            display: flex;
            align-items:center;
            gap: 1rem;

            .torrent {
              display: grid;
              grid-template-columns: 1fr auto;

              .status {
                display: grid;
                grid-template-rows: 1fr auto;
                color: #fff;
                text-decoration: none;
                
                .seeders, .leechers {
                  z-index: 100;
                  display: flex;
                  align-items: center;
                }
              }
              .magnet {
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 100;
                padding: 0 1rem;
              }
            }
          }
        }
      }

      .actions {
        display: flex;
        margin-top: auto;
        column-gap: 5rem;
        .watch, .download {
          width: 20rem;
          text-transform: uppercase;
          margin: 0.5rem 0;
          padding: 2rem;
          border: 0.1rem solid rgb(75, 75, 75);
          background-color: rgb(75, 75, 75);
          color: #fff;
          text-decoration: none;
          text-align: center;
        }
      }
    }
  }
`

export default ({ uri, titleUri }: { uri: string, titleUri?: string }) => {
  const [automaticResolutionSelection, setAutomaticResolutionSelection] = useState<boolean>(true)
  const [selectedResolution, setResolution] = useState<number | undefined>(1080)
  const { observable: series$, value: series } = useObservable(() =>
    getSeries({ uri }, { fetch: cachedDelayedFetch }),
    [uri]
  )
  const { observable: seriesReplay$ } = useObservable(() => series$.pipe(shareReplay()), [series$])

  const { observable: titles$, value: titles, completed: seriesTitlesCompleted } = useObservable(() =>
    seriesReplay$
      .pipe(
        filter(Boolean),
        mergeMap(series => searchTitles({ series }, { fetch: cachedDelayedFetch }))
      ),
    [seriesReplay$]
  )
  console.log('titles', titles)
  const { observable: titlesReplay$ } = useObservable(() => titles$.pipe(shareReplay()), [titles$])

  const firstTitleUri = titles?.at(0)?.uri

  const { value: title, completed: titleHandlesCompleted } = useObservable(
    () =>
      series
        ? (
          titlesReplay$
            .pipe(
              map(titles => titles.find(({ uri }) => uri === (titleUri ?? firstTitleUri))),
              filter(Boolean),
              mergeMap(title => searchTitles({ series, search: title }, { fetch: cachedDelayedFetch }))
            )
        )
        : from([]),
    [series, titlesReplay$, titleUri ?? firstTitleUri]
  )
  const seriesTitlesLoading = !seriesTitlesCompleted
  const titlesLoading = !titleHandlesCompleted

  const dateData = series?.dates?.at(0)

  const releaseDate =
    series && dateData && 'date' in dateData &&
    (series.categories.some(category => category === 'MOVIE')
      ? `${dateData.date.getFullYear()}`
      : `${dateData.date.toDateString().slice(4).trim()}`)

  const dateStart =
    dateData &&
    !('date' in dateData) &&
    dateData.start.toDateString().slice(4).trim()
  const dateEnd =
    dateData &&
    !('date' in dateData) &&
    dateData.end?.toDateString().slice(4).trim()

  const airingDate =
    series && dateData && !('date' in dateData) &&
    dateData.end
      ? `${dateStart} to ${dateEnd}`
      : `Started ${dateStart}`

  const release =
    series && dateData
      ? (
        'date' in dateData
          ? releaseDate
          : airingDate
      )
      : ''

  const titleHandles = title?.handles ?? []

  const byResolution =
    pipe(
      reverse(N.Ord),
      contramap(([resolution]: [number, NonEmptyArray<TitleHandle>]) => resolution)
    )

  const bySeriesSimilarity =
    pipe(
      reverse(N.Ord),
      contramap((_series: TitleHandle) => diceCompare(series?.names.at(0)?.name!, _series.name))
    )

  const mediaTitleHandlesByResolution =
    pipe(
      titleHandles,
      A.filter(handle => {
        const meta = handle.tags?.find(({ type }) => type === 'meta')?.value
        if (!meta) return true
        if (meta.includes('HEVC') || meta.includes('x265')) return false
        return true
      }),
      A.filter(handle => !!handle.tags?.find(({ type }) => type === 'source')?.value),
      // A.sort(bySeriesSimilarity),
      // @ts-ignore
      groupBy(handle => handle.resolution?.toString()),
      R.toArray,
      A.map(([resolution, handle]) => [resolution ? Number(resolution) : undefined, handle] as const),
      A.sort(byResolution)
    )

  const resolutions =
    pipe(
      mediaTitleHandlesByResolution,
      A.map(([resolution]) => resolution),
      A.filter(resolution => !isNaN(resolution))
    )

  useEffect(() => {
    console.log('res effect', resolutions, automaticResolutionSelection)
    if(!resolutions.length || !automaticResolutionSelection) return
    console.log('res effect setResolution', Math.max(...resolutions))
    setResolution(Math.max(...resolutions))
  }, [resolutions.join(','), automaticResolutionSelection])

  const selectResolution = (resolution: number) => {
    setAutomaticResolutionSelection(false)
    setResolution(resolution ? Number(resolution) : undefined)
  }

  const selectedResolutionTitles =
    pipe(
      mediaTitleHandlesByResolution,
      A.filter(([resolution]) => resolution === selectedResolution),
      A.map(([, handle]) => handle),
      A.flatten
    )

  // todo: remove results with no seeders
  const { left: singularTitles, right: batchTitles } =
    pipe(
      selectedResolutionTitles,
      A.filter((handle) => handle.number === title?.number),
      A.partition((handle) => Boolean(handle.batch))
    )

  const byHandleSeeders =
    pipe(
      N.Ord,
      contramap((handle: TitleHandle) => handle.tags.find(({ type }) => type === 'source')?.value.seeders),
      reverse
    )

  const mostSeededTitle =
    pipe(
      singularTitles,
      sort(byHandleSeeders),
      A.head,
      toUndefined
    )

  
  const mainSeriesName =
    series
      ?.names
      ?.find(({ language }) => language === 'en')
      ?.name
    ?? series?.names?.at(0)?.name

  const secondarySeriesNames =
    series
    ?.names
    ?.filter(({ score, name }) => score >= 0.8 && name !== mainSeriesName)

  const mainTitleName =
    title
      ?.names
      ?.find(({ language }) => language === 'en')
      ?.name
    ?? title?.names?.at(0)?.name

  const secondaryTitleNames =
    title
    ?.names
    ?.filter(({ score, name }) => score >= 0.8 && name !== mainTitleName)

  console.log('series', series)
  console.log('title', title)
  // console.log('targets', targets)
  // console.log('selectedResolution', selectedResolution)

  const renderTitleHandleName = (handle: TitleHandle) => {
    // todo: reintroduce once we support batches
    if (handle.batch) return null
    const teamTag = handle.team
    const teamEpisodeTag = handle.tags?.find(({ type }) => type === 'team-episode')
    const sourceTag = handle.tags?.find(({ type }) => type === 'source')
    const name = handle.names?.at(0)?.name
    return (
      <div
        className="source"
        key={`${handle.uri}-${handle.names?.findIndex(({ name: _name }) => _name === name)}`}
      >
        <Link
          className="backlink"
          href={
            getRoutePath(
              Route.WATCH,
              {
                uri,
                titleUri:
                  titleUri ?? firstTitleUri,
                sourceUri: handle.uri
              }
            )
          }
        />
        {
          handle.batch
            ? <span>[BATCH]</span>
            : null
        }
        <a href={teamEpisodeTag?.value?.url ?? teamTag?.url} className="team" target="_blank" rel="noopener noreferrer">
          {
            teamTag?.icon
            && (
              <img
                className="team-icon"
                src={teamTag?.icon}
                alt={`[${teamTag?.tag}]`}
                title={teamTag?.name}
              />
            )
          }
          <span>
            {
              teamTag?.tag
                ? `[${teamTag?.tag}]`
                : null
            }
          </span>
        </a>
        <span className="name">
          {name}
        </span>
        <span className="info">
          <span className="size">
            {getHumanReadableByteString(handle.size)}
          </span>
          {
            sourceTag?.value.type === 'torrent-file'
              ? (
                <span className="torrent">
                  <a  className="magnet" href={sourceTag?.value.magnetUri}>
                    <FontAwesomeIcon icon={faMagnet}/>
                  </a>
                  <Link
                    className="status"
                    href={
                      getRoutePath(
                        Route.WATCH,
                        {
                          uri,
                          titleUri:
                            titleUri ?? firstTitleUri,
                          sourceUri: handle.uri
                        }
                      )
                    }
                  >
                    <div className="seeders" title="seeders">
                      <ChevronUp/>
                      {sourceTag?.value.seeders}
                    </div>
                    <div className="leechers" title="leechers">
                      <ChevronDown/>
                      {sourceTag?.value.leechers}
                    </div>
                  </Link>
                </span>
              )
              : null
          }
        </span>
      </div>
    )
  }

  return (
    <div css={style}>
      <img src={series?.images?.at(0)?.url} alt={`${series?.names?.at(0)?.name} poster`} className="poster" />
      <div className="series">
        <div>
          <div className="title-bar">
            <h1>{mainSeriesName}</h1>
            {
              secondarySeriesNames?.map((name, i) =>
                <h2 key={i}>
                  {name.name}
                </h2>  
              )
            }
          </div>
          <div className="data">
            <div className="date"> 
              {release}
            </div>
            <span className="score">
              {
                series?.averageScore
                  ? (
                    <>
                      <span>{(series?.averageScore * 10).toFixed(1)}</span>
                      <Heart/>
                    </>
                  )
                  : null
              }
            </span>
            <div className="sources">
              <Sources handles={series?.handles}/>
            </div>
          </div>
        </div>
        <div className="synopsis">
          {series?.synopses?.at(0)?.synopsis}
        </div>
      </div>
      <div className="titles">
        <div className="list">
          {
            titles?.map(title => {
              const mainTitleName =
                title
                  ?.names
                  ?.find(({ language }) => language === 'en')
                  ?.name
                ?? title?.names?.at(0)?.name
                ?? `Episode ${title.number}`
            
              const secondaryTitleNames =
                title
                ?.names
                ?.filter(({ score, name }) => score >= 0.8 && name !== mainTitleName)

              return (
                // todo: replace the title number with a real number
                <Link
                  key={title.uri}
                  className={`title ${title.uri === (titleUri ?? firstTitleUri) ? 'selected' : ''}`}
                  href={getRoutePath(Route.TITLE_EPISODE, { uri, titleUri: title.uri })}
                  onClick={(ev) => {
                    ev.preventDefault()
                    navigate(getRoutePath(Route.TITLE_EPISODE, { uri, titleUri: title.uri }), true)
                  }}
                >
                  <span className="number">
                    {title.names?.at(0)?.name ? title.number ?? '' : ''}
                  </span>
                  <span className="name">
                    <span className="main">{mainTitleName}</span>
                    {
                      secondaryTitleNames?.map((name, i) =>
                        <span key={i} className="secondary">
                          {name.name}
                        </span>
                      )
                    }
                  </span>
                  <span className="data">
                    <span className="score">
                      {
                        title?.averageScore
                          ? (
                            <>
                              <span>{(title?.averageScore * 10).toFixed(1)}</span>
                              <Heart/>
                            </>
                          )
                          : null
                      }
                    </span>
                    <span className="date">{title.dates?.at(0)?.date!.toDateString().slice(4).trim() ?? ''}</span>
                  </span>
                </Link>
              )
            })
          }
          {
            seriesTitlesLoading && (
              [...Array(titles?.length ? 3 : 10).keys()].map((i, _, arr) =>
                <div key={i} className="title gradient" style={{ opacity: 1 / (arr.length / (arr.length - i)) }}>
                </div>
              )
            )
          }
        </div>
        <div className="title-info">
          <div className="title">
            <h2>{mainTitleName}</h2>
            {
              secondaryTitleNames?.map((titleName, i) =>
                <h3 key={i}>
                  {titleName.name}
                </h3>
              )
            }
          </div>
          <div className="synopsis">
            {
              !title?.synopses ? 'Loading...' :
              title?.synopses?.at(0)?.synopsis ?? 'No synopsis found'
            }
          </div>
          <div>
            <div className="search-override">
              <Input
                type="text"
                label='Search override'
                placeholder={`${
                  series?.names.at(0)?.name
                } ${
                  titles
                    ?.find(({ uri }) => uri === (titleUri ?? firstTitleUri))
                    ?.number
                    ?.toString()
                    .padStart('2', 0)
                }`}
              />
            </div>
            <div className='resolutions'>
              {
                mediaTitleHandlesByResolution.map(([resolution]) =>
                  <span
                    key={resolution}
                    className={((resolution ? Number(resolution) : undefined) === selectedResolution) ? 'selected' : ''}
                    onClick={() => selectResolution(resolution)}
                  >
                    {
                      resolution
                        ? `${resolution}p`
                        : 'Unknown resolution'
                    }
                  </span>
                )
              }
            </div>
            <div className="sources">
              {batchTitles.map(renderTitleHandleName)}
              {singularTitles.map(renderTitleHandleName)}
              {
                titlesLoading && (
                  [...Array(selectedResolutionTitles?.length ? 3 : 10).keys()].map((i, _, arr) =>
                    <div key={i} className="title-placeholder gradient source" style={{ opacity: 1 / (arr.length / (arr.length - i)) }}>
                    </div>
                  )
                )
              }
            </div>
          </div>
          <div className="actions">
              {
                mostSeededTitle
                  ? (
                    <>
                      <Link
                        className="watch"
                        href={
                          getRoutePath(
                            Route.WATCH,
                            {
                              uri,
                              titleUri: uri,
                              sourceUri: mostSeededTitle.uri
                            }
                          )
                        }
                      >
                        Watch
                      </Link>
                      <div className="download">
                        Download
                      </div>
                    </>
                  )
                  : null
              }
            </div>
        </div>
      </div>
    </div>
  )
}
