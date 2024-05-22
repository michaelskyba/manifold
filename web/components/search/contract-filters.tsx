import clsx from 'clsx'
import { track } from 'web/lib/service/analytics'
import { Col } from '../layout/col'
import { getLabelFromValue } from './search-dropdown-helpers'

import { useState } from 'react'
import { FaSortAmountDownAlt } from 'react-icons/fa'
import { FaFileContract, FaFilter, FaSliders } from 'react-icons/fa6'
import { IconButton } from 'web/components/buttons/button'
import { Carousel } from 'web/components/widgets/carousel'
import { MODAL_CLASS, Modal } from '../layout/modal'
import { Row } from '../layout/row'
import {
  BOUNTY_MARKET_SORTS,
  CONTRACT_TYPES,
  ContractTypeType,
  DEFAULT_BOUNTY_SORTS,
  DEFAULT_CONTRACT_TYPE,
  DEFAULT_CONTRACT_TYPES,
  DEFAULT_FILTER,
  DEFAULT_POLL_SORTS,
  DEFAULT_SORT,
  DEFAULT_SORTS,
  FILTERS,
  Filter,
  POLL_SORTS,
  PREDICTION_MARKET_PROB_SORTS,
  PREDICTION_MARKET_SORTS,
  SORTS,
  SearchParams,
  Sort,
  bountySorts,
  predictionMarketSorts,
} from '../supabase-search'
import { AdditionalFilterPill, FilterPill } from './filter-pills'
import { SpiceCoin } from 'web/public/custom-components/spiceCoin'

export function ContractFilters(props: {
  className?: string
  includeProbSorts?: boolean
  params: SearchParams
  updateParams: (params: Partial<SearchParams>) => void
  topicSlug: string
  showTopicTag?: boolean
  setTopicSlug?: (slug: string) => void
}) {
  const {
    className,
    topicSlug,
    setTopicSlug,
    includeProbSorts,
    params,
    updateParams,
    showTopicTag,
  } = props

  const {
    s: sort,
    f: filter,
    ct: contractType,
    p: isPrizeMarketString,
  } = params

  const selectFilter = (selection: Filter) => {
    if (selection === filter) return

    updateParams({ f: selection })
    track('select search filter', { filter: selection })
  }

  const selectSort = (selection: Sort) => {
    if (selection === sort) return

    if (selection === 'close-date') {
      updateParams({ s: selection, f: 'open' })
    } else if (selection === 'resolve-date') {
      updateParams({ s: selection, f: 'resolved' })
    } else {
      updateParams({ s: selection })
    }

    track('select search sort', { sort: selection })
  }

  const selectContractType = (selection: ContractTypeType) => {
    if (selection === contractType) return

    if (selection === 'BOUNTIED_QUESTION' && predictionMarketSorts.has(sort)) {
      updateParams({ s: 'bounty-amount', ct: selection })
    } else if (selection !== 'BOUNTIED_QUESTION' && bountySorts.has(sort)) {
      updateParams({ s: 'score', ct: selection })
    } else {
      updateParams({ ct: selection })
    }
    track('select contract type', { contractType: selection })
  }

  const togglePrizeMarket = () => {
    updateParams({
      p: isPrizeMarketString == 'true' ? 'false' : 'true',
    })
  }

  const hideFilter =
    sort === 'resolve-date' ||
    sort === 'close-date' ||
    contractType === 'BOUNTIED_QUESTION'

  const filterLabel = getLabelFromValue(FILTERS, filter)
  const sortLabel = getLabelFromValue(SORTS, sort)
  const contractTypeLabel = getLabelFromValue(CONTRACT_TYPES, contractType)

  const sortItems =
    contractType == 'BOUNTIED_QUESTION'
      ? DEFAULT_BOUNTY_SORTS
      : contractType == 'POLL'
      ? DEFAULT_POLL_SORTS
      : DEFAULT_SORTS

  const [openFilterModal, setOpenFilterModal] = useState(false)

  const nonDefaultFilter = filter !== DEFAULT_FILTER
  const nonDefaultSort =
    !DEFAULT_SORTS.some((s) => s == sort) && sort !== DEFAULT_SORT
  const nonDefaultContractType =
    !DEFAULT_CONTRACT_TYPES.some((ct) => ct == contractType) &&
    contractType !== DEFAULT_CONTRACT_TYPE

  return (
    <Col className={clsx('mb-1 mt-2 items-stretch gap-1 ', className)}>
      <Carousel labelsParentClassName="gap-1 items-center">
        <IconButton
          size="2xs"
          className="p-1"
          onClick={() => setOpenFilterModal(true)}
        >
          <FaSliders className="h-4 w-4" />
        </IconButton>
        {nonDefaultFilter && (
          <AdditionalFilterPill
            type="filter"
            onXClick={() => selectFilter(DEFAULT_FILTER)}
          >
            {filterLabel}
          </AdditionalFilterPill>
        )}
        {nonDefaultSort && (
          <AdditionalFilterPill
            type="sort"
            onXClick={() => selectSort(DEFAULT_SORT)}
          >
            {sortLabel}
          </AdditionalFilterPill>
        )}
        {nonDefaultContractType && (
          <AdditionalFilterPill
            type="contractType"
            onXClick={() => selectContractType(DEFAULT_CONTRACT_TYPE)}
          >
            {contractTypeLabel}
          </AdditionalFilterPill>
        )}
        <FilterPill
          selected={isPrizeMarketString === 'true'}
          onSelect={togglePrizeMarket}
          type="spice"
          className="gap-1"
        >
          <div className="flex w-4 items-center">
            <SpiceCoin
              className={isPrizeMarketString !== 'true' ? 'opacity-50' : ''}
            />
          </div>
          Prize
        </FilterPill>
        {!!setTopicSlug && (!topicSlug || topicSlug == 'for-you') && (
          <FilterPill
            selected={topicSlug === 'for-you'}
            onSelect={() => setTopicSlug('for-you')}
            type="filter"
          >
            For you
          </FilterPill>
        )}
        {sortItems.map((sortValue) => (
          <FilterPill
            key={sortValue}
            selected={sortValue === sort}
            onSelect={() => {
              if (sort === sortValue) {
                selectSort(DEFAULT_SORT)
              } else {
                selectSort(sortValue as Sort)
              }
            }}
            type="sort"
          >
            {getLabelFromValue(SORTS, sortValue)}
          </FilterPill>
        ))}
        {DEFAULT_CONTRACT_TYPES.map((contractValue) => (
          <FilterPill
            key={contractValue}
            selected={contractValue === contractType}
            onSelect={() => {
              if (contractValue === contractType) {
                selectContractType(DEFAULT_CONTRACT_TYPE)
              } else {
                selectContractType(contractValue as ContractTypeType)
              }
            }}
            type="contractType"
          >
            {getLabelFromValue(CONTRACT_TYPES, contractValue)}
          </FilterPill>
        ))}
      </Carousel>
      <FilterModal
        open={openFilterModal}
        setOpen={setOpenFilterModal}
        params={params}
        selectFilter={selectFilter}
        selectSort={selectSort}
        selectContractType={selectContractType}
        togglePrizeMarket={togglePrizeMarket}
        hideFilter={hideFilter}
        setTopicSlug={setTopicSlug}
        topicSlug={topicSlug}
      />
    </Col>
  )
}

function FilterModal(props: {
  open: boolean
  setOpen: (open: boolean) => void
  params: SearchParams
  selectFilter: (selection: Filter) => void
  selectSort: (selection: Sort) => void
  selectContractType: (selection: ContractTypeType) => void
  togglePrizeMarket: () => void
  hideFilter: boolean
  setTopicSlug?: (slug: string) => void
  topicSlug?: string
}) {
  const {
    open,
    setOpen,
    params,
    selectFilter,
    selectContractType,
    selectSort,
    togglePrizeMarket,
    hideFilter,
    setTopicSlug,
    topicSlug,
  } = props
  const {
    s: sort,
    f: filter,
    ct: contractType,
    p: isPrizeMarketString,
  } = params

  const sortItems =
    contractType == 'BOUNTIED_QUESTION'
      ? BOUNTY_MARKET_SORTS
      : contractType == 'POLL'
      ? POLL_SORTS
      : contractType === 'ALL' || contractType === 'BINARY'
      ? PREDICTION_MARKET_PROB_SORTS
      : PREDICTION_MARKET_SORTS
  return (
    <Modal open={open} setOpen={setOpen}>
      <Col className={clsx(MODAL_CLASS, 'text-ink-600 text-sm')}>
        {!hideFilter && (
          <Col className="gap-1">
            <Row className="items-center gap-1 font-semibold">
              <FaFilter className="h-4 w-4" />
              Filters
            </Row>
            <Row className="flex-wrap gap-1">
              <FilterPill
                selected={isPrizeMarketString === 'true'}
                onSelect={togglePrizeMarket}
                type="spice"
              >
                <Row className="items-center gap-1">
                  <SpiceCoin
                    className={
                      isPrizeMarketString !== 'true' ? 'opacity-50' : ''
                    }
                  />
                  Prize
                </Row>
              </FilterPill>
              {!!setTopicSlug && (!topicSlug || topicSlug == 'for-you') && (
                <FilterPill
                  selected={topicSlug === 'for-you'}
                  onSelect={() => setTopicSlug('for-you')}
                  type="filter"
                >
                  For you
                </FilterPill>
              )}
              {!hideFilter &&
                FILTERS.map(({ label: filterLabel, value: filterValue }) => (
                  <FilterPill
                    key={filterValue}
                    selected={filterValue === filter}
                    onSelect={() => {
                      if (filterValue === filter) {
                        selectFilter(DEFAULT_FILTER)
                      } else {
                        selectFilter(filterValue as Filter)
                      }
                    }}
                    type="filter"
                  >
                    {filterLabel}
                  </FilterPill>
                ))}
            </Row>
          </Col>
        )}
        <Col className="gap-1">
          <Row className="items-center gap-1 font-semibold">
            <FaSortAmountDownAlt className="h-4 w-4" />
            Sorts
          </Row>
          <Row className="flex-wrap gap-1">
            {sortItems.map(({ label: sortLabel, value: sortValue }) => (
              <FilterPill
                key={sortValue}
                selected={sortValue === sort}
                onSelect={() => {
                  if (sortValue === sort) {
                    selectSort(DEFAULT_SORT)
                  } else {
                    selectSort(sortValue as Sort)
                  }
                }}
                type="sort"
              >
                {sortLabel}
              </FilterPill>
            ))}
          </Row>
        </Col>
        <Col className="gap-1">
          <Row className="items-center gap-1 font-semibold">
            <FaFileContract className="h-4 w-4" />
            Market Type
          </Row>
          <Row className="flex-wrap gap-1">
            {CONTRACT_TYPES.map(
              ({ label: contractTypeLabel, value: contractTypeValue }) => (
                <FilterPill
                  key={contractTypeValue}
                  selected={contractTypeValue === contractType}
                  onSelect={() => {
                    if (contractTypeValue === contractType) {
                      selectContractType(DEFAULT_CONTRACT_TYPE)
                    } else {
                      selectContractType(contractTypeValue as ContractTypeType)
                    }
                  }}
                  type="contractType"
                >
                  {contractTypeLabel}
                </FilterPill>
              )
            )}
          </Row>
        </Col>
      </Col>
    </Modal>
  )
}