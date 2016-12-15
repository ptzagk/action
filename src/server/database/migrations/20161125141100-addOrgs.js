import shortid from 'shortid';
import {TRIAL_PERIOD} from '../../utils/serverConstants';
import ms from 'ms';
import {TRIAL_EXPIRED, TRIAL_EXPIRES_SOON} from '../../../universal/utils/constants'
/* eslint-disable max-len */
// taya, jordan, terry, matt
// const productTeam = [
//   'auth0|5797eb5d12664ba4675745b9',
//   'auth0|57a8fb6cab6c18473e47f518',
//   'auth0|5797e83170dddc395d8d1675',
//   'auth0|5797eb9712664ba4675745c3'
// ];
// const engineeringTeam = [
//   'auth0|57a8fb6cab6c18473e47f518',
//   'auth0|5797e83170dddc395d8d1675',
//   'auth0|5797eb9712664ba4675745c3'
// ];
exports.up = async(r) => {
  const tables = [
    r.tableCreate('Organization'),
    r.tableCreate('Notification')
  ];
  try {
    await Promise.all(tables);
  } catch (e) {
  }
  const indices = [
    r.table('Team').indexCreate('orgId'),
    r.table('Notification').indexCreate('orgId'),
    r.table('Notification').indexCreate('parentId'),
    r.table('Notification').indexCreate('userId'),
    r.table('User').indexCreate('email'),
    r.table('User').indexCreate('orgs', {multi: true}),
    r.table('User').indexCreate('billingLeaderOrgs', {multi: true}),
  ];
  try {
    await Promise.all(indices);
  } catch (e) {
  }

  const waitIndices = [
    r.table('Team').indexWait('orgId'),
    r.table('Notification').indexWait('orgId', 'parentId', 'userId'),
    r.table('User').indexWait('email', 'orgs', 'billingLeaderOrgs')
  ];
  await Promise.all(waitIndices);

  const now = new Date();
  const trialExpiresAt = new Date(now + TRIAL_PERIOD);
  const teamLeaders = await r.table('TeamMember').filter({isLead: true});
  // make them unique
  const teamLeaderUserIds = Array.from(new Set(teamLeaders.map((leader) => leader.userId)));
  const teamLeaderUsers = await r.table('User').getAll(r.args(teamLeaderUserIds), {index: 'id'});

  const orgLeaders = teamLeaderUsers.map((teamLeaderUser) => {
    const orgId = shortid.generate();
    return {
      ...teamLeaderUser,
      billingLeaderOrgs: [orgId],
      // orgs: [orgId],
      orgId,
      orgName: `${teamLeaderUser.preferredName}'s Org`,
      expiresSoonId: shortid.generate(),
      expiredId: shortid.generate(),
      trialExpiresAt,
      varList: [trialExpiresAt]
    };
  }, {});
  const orggedTeamLeaders = teamLeaders.map((teamLeader) => {
    return {
      ...teamLeader,
      orgId: orgLeaders.find(leader => leader.id === teamLeader.userId).orgId
    }
  });
  console.log('orgLeaders', orgLeaders)
  await r.expr(orggedTeamLeaders)
    .forEach((teamLeader) => {
      // add the org to the teams that the teamLeader owns
      return r.table('Team')
        .get(teamLeader('teamId')).update({
          orgId: teamLeader('orgId')
        })
    })
    // add the org itself
    .do(() => {
      return r.expr(orgLeaders)
        .forEach((orgLeader) => {
          return r.table('Organization')
            .insert({
              id: orgLeader('orgId'),
              // billingLeaders: orgLeader('billingLeaders'),
              createdAt: now,
              isTrial: true,
              name: orgLeader('orgName'),
              updatedAt: now,
              validUntil: trialExpiresAt
            })
            // add expiry notifications
            .do(() => {
              return r.table('Notification')
                .insert([
                  {
                    id: orgLeader('expiresSoonId'),
                    parentId: orgLeader('expiresSoonId'),
                    type: TRIAL_EXPIRES_SOON,
                    varList: orgLeader('varList'),
                    startAt: new Date(now + ms('14d')),
                    endAt: trialExpiresAt,
                    userId: orgLeader('id'),
                    orgId: orgLeader('orgId'),
                  },
                  {
                    id: orgLeader('expiredId'),
                    parentId: orgLeader('expiredId'),
                    type: TRIAL_EXPIRED,
                    varList: orgLeader('varList'),
                    startAt: trialExpiresAt,
                    endAt: new Date(trialExpiresAt + ms('10y')),
                    userId: orgLeader('id'),
                    orgId: orgLeader('orgId'),
                  }
                ])
            })
            // set an expiry for every team orgLeader and all the orgs the user belongs to
            .do(() => {
              return r.table('User')
                .get(orgLeader('id'))
                .update({
                  billingLeaderOrgs: orgLeader('billingLeaderOrgs'),
                  // orgs: orgLeader('orgs'),
                  trialExpiresAt
                });
            });
        })
    });
  await r.table('User').update({
    orgs: r.table('Team').getAll(r.args(r.row('tms')), {index: 'id'})('orgId').distinct()
  }, {nonAtomic: true})
};

exports.down = async(r) => {
  const tables = [
    r.tableDrop('Organization'),
    r.tableDrop('Notification'),
    r.table('Team').indexDrop('orgId'),
    r.table('User').indexDrop('email'),
    r.table('User').indexDrop('orgs'),
    r.table('User').indexDrop('billingLeaderOrgs'),
    r.table('Team').replace((row) => row.without('orgId')),
    r.table('User').replace((row) => row.without('trialExpiresAt', 'orgs', 'billingLeaderOrgs')),
  ];
  await Promise.all(tables);
};