import getRethink from 'server/database/rethinkDriver';
import {GraphQLList, GraphQLNonNull, GraphQLID, GraphQLInt} from 'graphql';
import {Project} from './projectSchema';
import {errorObj} from '../utils';
import {requireAuth, requireSUOrTeamMember} from '../authorization';

export default {
  getArchivedProjects: {
    type: new GraphQLList(Project),
    description: 'A paginated query for all the archived projects for a team',
    args: {
      teamId: {
        type: new GraphQLNonNull(GraphQLID),
        description: 'The team ID for the desired team'
      },
      first: {
        type: new GraphQLNonNull(GraphQLInt),
        description: 'the number of documents to fetch'
      },
      after: {
        type: GraphQLID,
        description: 'The pagination cursor'
      }
    },
    async resolve(source, {teamId, first, after}, {authToken}) {
      const r = getRethink();
      requireSUOrTeamMember(authToken, teamId);
      const cursor = after || r.minval;
      const result = await r.table('Project')
        .between([teamId, cursor], [teamId, r.maxval], {index: 'teamIdCreatedAt', leftBound: 'open'})
        .filter({isArchived: true})
        .limit(first);
      return result;
    }
  },
  getCurrentProject: {
    type: Project,
    description: 'Given an auth token, return the user and auth token',
    async resolve(source, args, {authToken}) {
      const r = getRethink();
      const userId = requireAuth(authToken);
      const user = await r.table('Project').get(userId);
      if (!user) {
        throw errorObj({_error: 'Project ID not found'});
      }
      return user;
    }
  }
};
