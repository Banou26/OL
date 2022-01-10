import Category from '../category'

import * as MyAnimeList from './myanimelist'
import * as Google from './google'
import * as GogoAnime from './gogoanime'
// import { filterTagets } from '../utils'
import { Search, GetLatest, GetLatestOptions, GenreHandle, GetGenres, SearchFilter } from '../types'
import { Episode, EpisodeHandle, Get, GetEpisode, GetGenre, GetOptions, GetTitle, Handle, SearchEpisode, SearchGenre, SearchTitle, Title, TitleHandle } from '..'

const targets: Target[] = [
  MyAnimeList,
  // Google,
  // GogoAnime
]

export default targets

export interface Target {
  categories?: Category[]
  scheme: string
  name: string
  searchTitle?: SearchTitle
  searchEpisode?: SearchEpisode
  searchGenre?: SearchGenre
  getTitle?: GetTitle
  getEpisode?: GetEpisode
  getGenre?: GetGenre
}

type TargetCallable =
  Omit<Target, 'categories' | 'scheme' | 'name'>

// const filterTargets =
//   (targets: Target[], func: (target: Target) => boolean) =>
//     (func2: (target: Target) => boolean) =>
//       targets
//         .filter(func)
//         .filter(func2)

// const filterSearch = filterTargets(targets, ({ search }) => !!search)
// const filterGetLatest = filterTargets(targets, ({ getLatest }) => !!getLatest)

export const search = ({ search, categories, genres }) => {
  // const filteredTargets = filterSearch({ categories, genres })
  // const results = filteredTargets.map(target => target.search!({ search, categories, genres }))

  // return (
  //   Promise
  //   .allSettled(results)
  //   .then(results =>
  //     results
  //       .filter(result => result.status === 'fulfilled')
  //       .flatMap((result) => (result as unknown as PromiseFulfilledResult<SearchResult>).value)
  //   )
  // )
}

const targetGenres = new Map<Target, GenreHandle<true>[]>()

// const getGenres = async (target: Target, options?: SearchFilter) => {
//   if (targetGenres.has(target)) return targetGenres.get(target)!
//   if (!target.getGenres) return []
//   const genres = await target.getGenres(options)
//   targetGenres.set(target, genres)
//   return genres
// }

type PopulateHandleReturn<T> =
  T extends TitleHandle<true> ? TitleHandle<false> :
  T extends EpisodeHandle<true> ? EpisodeHandle<false> :
  never

const populateHandle = <T extends TitleHandle<true> | EpisodeHandle<true>>(target: Target, handle: T, title?: TitleHandle<true>): PopulateHandleReturn<T> => {
  return {
    ...handle,
    categories: target.categories,
    scheme: target.scheme,
    uri: `${target.scheme}:${title?.id ? `${title.id}(${handle.id})` : handle.id}`,
    handles: handle.handles?.map(curryPopulateHandle(target))
  } as unknown as PopulateHandleReturn<T>
}

// const populateHandle = <T extends TitleHandle<true> | EpisodeHandle<true> | undefined>(target: Target, handle: T):
//   T extends undefined ? <T extends TitleHandle<true> | EpisodeHandle<true>>(handle: T) => PopulateHandleReturn<T> :
//   PopulateHandleReturn<T> => {
//     if (handle === undefined) return <T extends TitleHandle<true> | EpisodeHandle<true>>(handle: T) => _populateHandle<T>(target, handle)
//     return _populateHandle<Exclude<T, undefined>>(target, handle as Exclude<T, undefined>)
//   }

const curryPopulateHandle =
  (target: Target, title?: TitleHandle<true>) =>
    <T extends TitleHandle<true> | EpisodeHandle<true>>(handle: T) =>
      populateHandle<T>(target, {
        ...handle,
        ...'episodes' in handle && {
          episodes: handle.episodes.map(curryPopulateHandle(target, handle))
        }
      }, title)

export const fromUri = (uri: string) => ({ scheme: uri.split(':')[0], id: uri.split(':')[1] })


// todo: implemement url get
export const get: Get = (params: Parameters<Get>[0]): ReturnType<Get> => {
  const filteredTargets = targets.filter(({ scheme, get }) => (scheme === scheme || scheme === fromUri(params.uri).scheme) && !!get)
  console.log('GETTTTTTTTTT filteredTargets', filteredTargets)
  const results =
    Promise
      .allSettled(
        filteredTargets
          .map(target =>
            target
              .get?.(params)
              .then(curryPopulateHandle(target))
          )
      )
      .then(results =>
        results
          .filter(result => {
            if (result.status === 'fulfilled') return true
            else {
              console.error(result.reason)
            }
          })
          .flatMap((result) => (result as unknown as PromiseFulfilledResult<Awaited<ReturnType<Get>>>).value)
      )

  // return results

  return {
    
  }
}

export const getLatest: GetLatest = (
  { categories, ...rest }: Parameters<GetLatest<false>>[0] =
  { categories: Object.values(Category) }
) => {
  console.log('categories', categories)
  console.log('targets', targets)
  const filteredTargets =
    targets
      .filter(({ getLatest }) => !!getLatest)
      .filter(({ categories: targetCategories }) =>
        categories
          ? categories.some(category => targetCategories?.includes(category))
          : true
      )
      .filter(target =>
        Object
          .entries(rest)
          .every(([key, val]) => target.getLatestOptions?.[key])
      )
  console.log('filteredTargets', filteredTargets)
  const results =
    filteredTargets
      .map(target =>
        target
          .getLatest?.({ categories, ...rest })
          .then(handles => handles.map(curryPopulateHandle(target)))
      )
  console.log('results', results)
  return (
    Promise
      .allSettled(results)
      .then(results =>
        results
          .filter(result => {
            if (result.status === 'fulfilled') return true
            else {
              console.error(result.reason)
            }
          })
          .flatMap((result) => (result as unknown as PromiseFulfilledResult<Awaited<ReturnType<GetLatest>>>).value)
      )
  )
}

export const getGenres = () => {

}

const filterTargets = <T extends keyof Target>(
  { targets, categories, method, params }:
  { targets: Target[], categories?: Category[], method: T, params: Omit<Target[T], 'function'> }
) =>
  targets
    .filter(target => !!target[method])
    .filter(({ categories: targetCategories }) =>
      categories
        ? categories.some(category => targetCategories?.includes(category))
        : true
    )
    .filter(target =>
      Object
        .keys(params ?? {})
        .every(key => target[method]?.[key])
    )

// todo: try to fix the typing issues
const filterTargetResponses = <T extends keyof TargetCallable>(
  { targets, categories, method, params, injectCategories }:
  { targets: Target[], categories?: Category[], method: T, params: Parameters<Exclude<Target[T], undefined>['function']>[0], injectCategories?: boolean }
): ReturnType<Exclude<Target[T], undefined>['function']> =>
  // @ts-ignore
  Promise
    .allSettled(
      targets
        .filter(target =>
          categories
            ? target[method]
            : true
        )
        .map(target =>
          void console.log('target[method]', target[method].function) ||
          target[method]
            // @ts-ignore
            ?.function({ categories, ...params })
            ?.then(handles =>
              void console.log('ASDASDASDA target[method]', handles) ||
              Array.isArray(handles)
                ? handles.map(curryPopulateHandle(target))
                : curryPopulateHandle(target)(handles)
            )
        )
    )
    .then(results =>
      results
        .filter(result => {
          if (result.status === 'fulfilled') return true
          else console.error(result.reason)
        })
        // @ts-ignore
        .flatMap((result) => (result as unknown as PromiseFulfilledResult<Awaited<ReturnType<Exclude<Target[T], undefined>['function']>>>).value)
    )

const makeEpisodeFromEpisodeHandles = (episodeHandles: EpisodeHandle<true>[]): Episode => ({
  __typename: 'Episode',
  categories: [...new Set(episodeHandles.flatMap(({ categories }) => categories))],
  uri: episodeHandles.map(({ uri }) => uri).join(','),
  names: episodeHandles.flatMap(({ names }) => names),
  images: episodeHandles.flatMap(({ images }) => images),
  releaseDates: episodeHandles.flatMap(({ releaseDates }) => releaseDates),
  synopses: episodeHandles.flatMap(({ synopses }) => synopses),
  handles: episodeHandles.flatMap(({ handles }) => handles),
  tags: [],
  related: []
})

const makeTitleFromTitleHandles = (titleHandles: TitleHandle<true>[]): Title => ({
  __typename: 'Title',
  categories: [...new Set(titleHandles.flatMap(({ categories }) => categories))],
  uri: titleHandles.map(({ uri }) => uri).join(','),
  names: titleHandles.flatMap(({ names }) => names),
  releaseDates: titleHandles.flatMap(({ releaseDates }) => releaseDates),
  images: titleHandles.flatMap(({ images }) => images),
  synopses: titleHandles.flatMap(({ synopses }) => synopses),
  related: [],
  handles: titleHandles,
  episodes: titleHandles.flatMap(({ episodes }) => episodes.map(handle => makeEpisodeFromEpisodeHandles([handle]))),
  recommended: [],
  tags: [],
  genres: []
})

const handles: Handle<true>[] = []

export const searchTitle: SearchTitle['function'] = async ({ categories, ...rest }) => {
  const _targets = filterTargets({
    targets,
    method: 'searchTitle',
    categories,
    params:
      Object.fromEntries(
        Object
          .entries({ ...rest, categories })
          .filter(([key, val])  => val !== undefined)
      )
  })
  console.log('REEEEEEEEEEEEEEEEEEEEEEEEEEEEEE', targets)
  console.log('mhmm', { ...rest, categories })
  console.log('_targets', _targets)

  const titleHandles = await filterTargetResponses({
    targets: _targets,
    categories,
    method: 'searchTitle',
    params: { ...rest, categories }
  }) as unknown as TitleHandle<true>[]
  console.log('titleHandles', titleHandles)

  for (const handle of titleHandles) handles.push(handle)

  return titleHandles.map(titleHandle => makeTitleFromTitleHandles([titleHandle]))
}

export const getTitle: GetTitle['function'] = async (args) => {
  const _targets = filterTargets({
    targets,
    method: 'getTitle',
    params: {}
  })
  console.log('getTitle REEEEEEEEEEEEEEEEEEEEEEEEEEEEEE', targets)
  console.log('getTitle mhmm', args)
  console.log('getTitle _targets', _targets)

  const titleHandles = await filterTargetResponses({
    targets: _targets,
    method: 'getTitle',
    params: args
  }) as unknown as TitleHandle<true>[]
  console.log('getTitle titleHandles', titleHandles)

  for (const handle of titleHandles) handles.push(handle)

  const title = makeTitleFromTitleHandles(titleHandles)

  console.log('getTitle title', title)

  return title
}
