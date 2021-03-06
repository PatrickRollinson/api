import { error, connectDb } from './index';
import { ObjectId } from 'mongodb';
import { Utils } from './utils';
import { UserRoleObj } from './interfaces';
import { userClass } from './user';

const utils = new Utils();
const userCollection = 'users';
const userGroupCollection = 'user-groups';
const userGroupUserCollection = 'user-group-users';
const actionRolesCollection = 'action-roles';

export class Auth {
    async authorised(resource, action, userId, userGroupId): Promise<{authorised: boolean, requiredRoles?: string[], message?: string}>{
        try {
            const userGroupRoleAuthorised = await this.userGroupRoleAuthorised(resource, action, userId, userGroupId);
            if(userGroupRoleAuthorised.authorised){
                return {authorised: true}
            } else {
                return {authorised: true, requiredRoles: userGroupRoleAuthorised.requiredRoles}
            }
        } catch(err) {
            error.log(`Auth.authorised, resource: ${resource}, action: ${action}, uid: ${userId}, userGroupId: ${userGroupId}`, err)
            return {authorised: false};
        }
    }

    getHighestUserRole(roleObject: UserRoleObj): string {
        if(roleObject.sysadmin) {
            return 'sysadmin';
        } else if (roleObject.admin) {
            return 'admin';
        } else {
            return 'user';
        }
    }

    async getUserGroupRole(userId, userGroupId): Promise<string> {
        try {
            const mongoDb = await connectDb();
            const userGroup = await mongoDb.collection(userGroupCollection).findOne({_id: new ObjectId(userGroupId)});
            const userGroupUser = await mongoDb.collection(userGroupUserCollection).findOne({userGroup: new ObjectId(userGroupId), user: new ObjectId(userId)});
            console.log(userGroup, userGroupUser)
            if (userGroupUser && userGroup) {
                return userGroupUser.role;
            } else {
                if (userGroup.type === 'open') {
                    return 'user';
                } else {
                    return null
                }
            }
        } catch(err) {
            error.log(`UserGroup.getUserGroupRole: userId: ${userId}, userGroupId: ${userGroupId}`, err);
            return null;
        }    
    }

    async userRoleAuthorised(resource, action, uid): Promise<boolean> {
        try {
            console.log(`User.actionUserRoleAuthorised ${resource}, ${action}, ${uid}}`);
            const mongoDb = await connectDb();
            const userId = await userClass.getUserIdFromUid(uid);
            const user = await mongoDb.collection(userCollection).findOne({_id: userId})
            if (user) {
                const roles = user.roles
                const highestUserRole = this.getHighestUserRole(roles);
                console.log(highestUserRole, user);
                if (highestUserRole === 'sysadmin') {
                    return true;
                } else {
                    return false; // need to add admin roles
                }
            } else {
                return false;
            }
        } catch(err) {
            error.log(`User.actionUserRoleAuthorised, resource: ${resource}, action: ${action}, uid: ${uid}`)
            return false;
        }
    }

    async userGroupRoleAuthorised(resource, action, userId, userGroupId): Promise<{authorised: boolean, requiredRoles?: string[], message?: string}> {
        try {
            const mongoDb = await connectDb();
            const userGroupRoles = await mongoDb.collection(actionRolesCollection).findOne({type: resource});
            const requiredUserGroupRoles = userGroupRoles[action];
            const userGroupRole = await this.getUserGroupRole(userId, userGroupId);
            if (userGroupRole && requiredUserGroupRoles) {
                const authorised = utils.isRoleInRolesRequired(userGroupRole, requiredUserGroupRoles);
                if (authorised) {
                    return {
                        authorised: true
                    };
                } else {
                    return {
                        authorised: false, 
                        requiredRoles: requiredUserGroupRoles, 
                        message: `User Role missing from User Group`
                    };
                }
            } else {
                return {
                    authorised: false, 
                    requiredRoles: requiredUserGroupRoles, 
                    message: `User Role missing from User Group`
                }
            }
        } catch(err) {
            error.log(`Auth.userGroupRoleAuthorised, resource: ${resource}, action: ${action}, uid: ${userId}, userGroupId: ${userGroupId}`)
            return {authorised: false};
        }
    }

    async getAuthActionsList(userRole: string, resource: string): Promise<any> {
        try {
            const mongoDb = await connectDb();
            const actionRoles = await mongoDb.collection(actionRolesCollection).findOne({type: resource});
            if(actionRoles) {
                const actionList = {}
                for(const action in actionRoles) {
                    if (action !== 'type' && action !== '_id' ) {
                        const requiredRoles = actionRoles[action];
                        actionList[action] = utils.isRoleInRolesRequired(userRole, requiredRoles)
                    }
                }
                return actionList;
            } else {
                return {};
            }
        } catch(err) {
            console.log('actionRoles Err. Resource: ', resource, ' UserRole: ', userRole, err);
            return {};
        }
    }
}



