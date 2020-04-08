import * as React from 'react'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as FsConstants from '../constants/fs'
import * as FsTypes from '../constants/types/fs'
import * as GregorGen from '../actions/gregor-gen'
import * as TeamsGen from '../actions/teams-gen'
import Teams, {OwnProps as MainOwnProps} from './main'
import {HeaderRightActions} from './main/header'
import openURL from '../util/open-url'
import * as Constants from '../constants/teams'
import * as WaitingConstants from '../constants/waiting'
import * as Types from '../constants/types/teams'
import {memoize} from '../util/memoize'
import {useTeamsSubscribe} from './subscriber'
import {useActivityLevels} from './common'
import flags from '../util/feature-flags'

type OwnProps = {}

// share some between headerRightActions on desktop and component on mobile
type HeaderActionProps = {
  onCreateTeam: () => void
  onJoinTeam: () => void
}
const useHeaderActions = (): HeaderActionProps => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  return {
    onCreateTeam: () => dispatch(TeamsGen.createLaunchNewTeamWizardOrModal()),
    onJoinTeam: () => dispatch(nav.safeNavigateAppendPayload({path: ['teamJoinTeamDialog']})),
  }
}

const orderTeamsImpl = (
  teams: Map<string, Types.TeamMeta>,
  newRequests: Map<Types.TeamID, Set<string>>
): Array<Types.TeamMeta> =>
  [...teams.values()].sort((a, b) => {
    const sizeDiff = (newRequests.get(b.id)?.size ?? 0) - (newRequests.get(a.id)?.size ?? 0)
    if (sizeDiff != 0) return sizeDiff
    return a.teamname.localeCompare(b.teamname)
  })

const orderTeams = memoize(orderTeamsImpl)

type ReloadableProps = Omit<MainOwnProps, 'onManageChat' | 'onViewTeam'>

const Reloadable = (props: ReloadableProps) => {
  const dispatch = Container.useDispatch()
  const loadTeams = React.useCallback(() => dispatch(TeamsGen.createGetTeams()), [dispatch])

  // subscribe to teams changes
  useTeamsSubscribe()
  // reload activity levels
  useActivityLevels(true)

  const headerActions = useHeaderActions()

  const nav = Container.useSafeNavigation()
  const otherActions = {
    onManageChat: (teamID: Types.TeamID) => dispatch(TeamsGen.createManageChatChannels({teamID})),
    onViewTeam: (teamID: Types.TeamID) =>
      dispatch(nav.safeNavigateAppendPayload({path: [{props: {teamID}, selected: 'team'}]})),
  }

  return (
    <Kb.Reloadable waitingKeys={Constants.teamsLoadedWaitingKey} onReload={loadTeams}>
      <Teams {...props} {...headerActions} {...otherActions} />
    </Kb.Reloadable>
  )
}

Reloadable.navigationOptions = {
  header: undefined,
  // This will be a filter box eventually
  headerRightActions: flags.teamsRedesign ? undefined : () => <ConnectedHeaderRightActions />,
  title: 'Teams',
}

const Connected = Container.connect(
  (state: Container.TypedState) => ({
    _teamresetusers: state.teams.teamIDToResetUsers || new Map(),
    _teams: state.teams.teamMeta,
    deletedTeams: state.teams.deletedTeams,
    loaded: !WaitingConstants.anyWaiting(state, Constants.teamsLoadedWaitingKey),
    newTeamRequests: state.teams.newTeamRequests,
    newTeams: state.teams.newTeams,
    sawChatBanner: state.teams.sawChatBanner || false,
  }),
  (dispatch: Container.TypedDispatch) => ({
    onHideChatBanner: () =>
      dispatch(GregorGen.createUpdateCategory({body: 'true', category: 'sawChatBanner'})),
    onOpenFolder: (teamname: Types.Teamname) =>
      dispatch(
        FsConstants.makeActionForOpenPathInFilesTab(FsTypes.stringToPath(`/keybase/team/${teamname}`))
      ),
    onReadMore: () => {
      openURL('https://keybase.io/blog/introducing-keybase-teams')
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => ({
    deletedTeams: stateProps.deletedTeams,
    loaded: stateProps.loaded,
    newTeamRequests: stateProps.newTeamRequests,
    newTeams: stateProps.newTeams,
    sawChatBanner: stateProps.sawChatBanner,
    teamresetusers: stateProps._teamresetusers,
    teams: orderTeams(stateProps._teams, stateProps.newTeamRequests),
    ...dispatchProps,
  })
)(Reloadable)

const ConnectedHeaderRightActions = (_: {}) => {
  const actions = useHeaderActions()
  return <HeaderRightActions {...actions} />
}

export default Connected
