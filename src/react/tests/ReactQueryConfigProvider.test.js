import React, { useState } from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import {
  ReactQueryConfigProvider,
  useQuery,
  queryCache,
  queryCaches,
} from '../index'

import { sleep } from './utils'

describe('ReactQueryConfigProvider', () => {
  afterEach(() => {
    queryCaches.forEach(cache => cache.clear({ notify: false }))
  })

  // // See https://github.com/tannerlinsley/react-query/issues/105
  it('should allow overriding the config', async () => {
    const onSuccess = jest.fn()

    const config = {
      queries: {
        onSuccess,
      },
    }

    function Page() {
      const { status } = useQuery('test', async () => {
        await sleep(10)
        return 'data'
      })

      return (
        <div>
          <h1>Status: {status}</h1>
        </div>
      )
    }

    const rendered = render(
      <ReactQueryConfigProvider config={config}>
        <Page />
      </ReactQueryConfigProvider>
    )

    await waitFor(() => rendered.getByText('Status: success'))

    expect(onSuccess).toHaveBeenCalledWith('data')
  })

  it('should allow overriding the default config from the outermost provider', async () => {
    const outerConfig = {
      queries: {
        queryFn: jest.fn(async () => {
          await sleep(10)
          return 'outer'
        }),
      },
    }

    const innerConfig = {
      queries: {
        queryFn: jest.fn(async () => {
          await sleep(10)
          return 'inner'
        }),
      },
    }

    function Container() {
      return (
        <ReactQueryConfigProvider config={outerConfig}>
          <ReactQueryConfigProvider config={innerConfig}>
            <h1>Placeholder</h1>
          </ReactQueryConfigProvider>
        </ReactQueryConfigProvider>
      )
    }

    const rendered = render(<Container />)

    await waitFor(() => rendered.findByText('Placeholder'))

    await queryCache.prefetchQuery('test')

    expect(outerConfig.queries.queryFn).toHaveBeenCalledWith('test')
    expect(innerConfig.queries.queryFn).not.toHaveBeenCalled()

    const data = queryCache.getQueryData('test')

    expect(data).toEqual('outer')
  })

  it('should reset to defaults when unmounted', async () => {
    const onSuccess = jest.fn()

    const config = {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
    }

    const queryFn = async () => {
      await sleep(10)
      return 'data'
    }

    function Container() {
      const [mounted, setMounted] = React.useState(true)

      return (
        <>
          <button onClick={() => setMounted(false)}>unmount</button>
          {mounted ? (
            <ReactQueryConfigProvider config={config}>
              <Page />
            </ReactQueryConfigProvider>
          ) : (
            <Page />
          )}
        </>
      )
    }

    function Page() {
      const { data } = useQuery('test', queryFn)

      return (
        <div>
          <h1>Data: {data || 'none'}</h1>
        </div>
      )
    }

    const rendered = render(<Container />)

    await waitFor(() => rendered.findByText('Data: none'))

    await act(() => queryCache.prefetchQuery('test', queryFn))

    await waitFor(() => rendered.findByText('Data: data'))

    // tear down and unmount
    // so we are NOT passing the config above
    fireEvent.click(rendered.getByText('unmount'))

    act(() => {
      // wipe query cache/stored config
      queryCache.clear({ notify: false })
      onSuccess.mockClear()
    })

    await waitFor(() => rendered.findByText('Data: data'))
  })

  it('should reset to previous config when nested provider is unmounted', async () => {
    let counterRef = 0
    const parentOnSuccess = jest.fn()

    const parentConfig = {
      queries: {
        onSuccess: parentOnSuccess,
      },
    }

    const childConfig = {
      queries: {
        // Override onSuccess of parent, making it a no-op
        onSuccess: undefined,
      },
    }

    const queryFn = async () => {
      await sleep(10)
      counterRef += 1
      return String(counterRef)
    }

    function Component() {
      const { data, refetch } = useQuery('test', queryFn)

      return (
        <div>
          <h1>Data: {data}</h1>
          <button onClick={() => refetch()}>refetch</button>
        </div>
      )
    }

    function Page() {
      const [childConfigEnabled, setChildConfigEnabled] = useState(true)

      return (
        <div>
          {childConfigEnabled && (
            <ReactQueryConfigProvider config={childConfig}>
              <Component />
            </ReactQueryConfigProvider>
          )}
          {!childConfigEnabled && <Component />}
          <button onClick={() => setChildConfigEnabled(false)}>
            disableChildConfig
          </button>
        </div>
      )
    }

    const rendered = render(
      <ReactQueryConfigProvider config={parentConfig}>
        <Page />
      </ReactQueryConfigProvider>
    )

    // await waitFor(() => rendered.getByText('Data: 1'))

    // expect(parentOnSuccess).not.toHaveBeenCalled()

    // fireEvent.click(rendered.getByText('refetch'))

    // await waitFor(() => rendered.getByText('Data: 2'))

    // expect(parentOnSuccess).not.toHaveBeenCalled()

    // parentOnSuccess.mockReset()

    // fireEvent.click(rendered.getByText('disableChildConfig'))

    // await waitFor(() => rendered.getByText('Data: 2'))

    // // it should not refetch on mount
    // expect(parentOnSuccess).not.toHaveBeenCalled()

    // fireEvent.click(rendered.getByText('refetch'))

    // await waitFor(() => rendered.getByText('Data: 3'))

    // expect(parentOnSuccess).toHaveBeenCalledTimes(1)
  })
})
