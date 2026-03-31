// Re-export User schema as AdminUser alias - there is no separate admin collection.
// The bot uses a single 'users' collection with role field: 'user' | 'student' | 'admin'
export {
  User as AdminUser,
  UserSchema as AdminUserSchema,
  UserDocument as AdminUserDocument,
} from "../../users/schemas/user.schema";
