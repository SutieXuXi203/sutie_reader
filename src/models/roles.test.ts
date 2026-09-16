import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { User } from './User';
import { Role } from './Role';
import { Post } from './Post';
import { DeletedAccount } from './DeletedAccount';

describe('Kiểm thử Ràng Buộc Schema & Vai Trò (Model Constraints)', () => {
  describe('User Model', () => {
    it('vai trò (role) chỉ cho phép: guest, user, admin', () => {
      const roleField = User.schema.path('role') as any;
      assert.ok(roleField, 'Field "role" phải tồn tại trong User schema');
      const enumValues = roleField.enumValues;
      assert.deepEqual(enumValues, ['guest', 'user', 'admin']);
    });

    it('vai trò mặc định (default role) của tài khoản mới phải là "guest"', () => {
      const roleField = User.schema.path('role') as any;
      assert.equal(roleField.defaultValue, 'guest');
    });

    it('trường isVerified mặc định là false khi đăng ký', () => {
      const isVerifiedField = User.schema.path('isVerified') as any;
      assert.equal(isVerifiedField.defaultValue, false);
    });
  });

  describe('Role Model', () => {
    it('danh sách tên vai trò chuẩn trong Role schema là: guest, user, admin', () => {
      const nameField = Role.schema.path('name') as any;
      assert.ok(nameField, 'Field "name" phải tồn tại trong Role schema');
      const enumValues = nameField.enumValues;
      assert.deepEqual(enumValues, ['guest', 'user', 'admin']);
    });
  });

  describe('DeletedAccount Model', () => {
    it('vai trò (role) trong DeletedAccount phải hỗ trợ cả "guest", "user", "admin"', () => {
      const roleField = DeletedAccount.schema.path('role') as any;
      assert.ok(roleField, 'Field "role" phải tồn tại trong DeletedAccount schema');
      const enumValues = roleField.enumValues;
      assert.deepEqual(enumValues, ['guest', 'user', 'admin']);
    });

    it('vai trò mặc định trong DeletedAccount là "guest"', () => {
      const roleField = DeletedAccount.schema.path('role') as any;
      assert.equal(roleField.defaultValue, 'guest');
    });
  });

  describe('Post Model Phân Quyền', () => {
    it('chế độ truy cập accessType chỉ cho phép: restricted, public', () => {
      const accessTypeField = Post.schema.path('accessType') as any;
      assert.ok(accessTypeField, 'Field "accessType" phải tồn tại trong Post schema');
      const enumValues = accessTypeField.enumValues;
      assert.deepEqual(enumValues, ['restricted', 'public']);
    });

    it('mặc định truyện mới tạo phải ở chế độ "restricted" để đảm bảo an toàn', () => {
      const accessTypeField = Post.schema.path('accessType') as any;
      assert.equal(accessTypeField.defaultValue, 'restricted');
    });
  });
});
