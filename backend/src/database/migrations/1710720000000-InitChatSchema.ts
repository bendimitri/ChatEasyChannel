import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class InitChatSchema1710720000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasUsers = await queryRunner.hasTable('users');
    if (!hasUsers) {
      await queryRunner.createTable(
        new Table({
          name: 'users',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'email', type: 'varchar', isUnique: true },
            { name: 'passwordHash', type: 'varchar' },
            { name: 'displayName', type: 'varchar', length: '120', isNullable: true },
            { name: 'sessionId', type: 'varchar', length: '64', isNullable: true },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      );
    }

    const hasRooms = await queryRunner.hasTable('rooms');
    if (!hasRooms) {
      await queryRunner.createTable(
        new Table({
          name: 'rooms',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'name', type: 'varchar', isUnique: true },
            { name: 'description', type: 'varchar', length: '255', isNullable: true },
            { name: 'createdByUserId', type: 'int', isNullable: true },
            { name: 'isDeleted', type: 'tinyint', width: 1, default: '0' },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
          ],
        }),
        true,
      );
    }

    const hasMessages = await queryRunner.hasTable('messages');
    if (!hasMessages) {
      await queryRunner.createTable(
        new Table({
          name: 'messages',
          columns: [
            { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
            { name: 'content', type: 'text' },
            { name: 'type', type: 'varchar', length: '16', default: "'text'" },
            { name: 'imageUrl', type: 'varchar', length: '500', isNullable: true },
            { name: 'isDeleted', type: 'tinyint', width: 1, default: '0' },
            { name: 'editedAt', type: 'datetime', isNullable: true },
            { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
            { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
            { name: 'userId', type: 'int' },
            { name: 'roomId', type: 'int' },
          ],
        }),
        true,
      );

      await queryRunner.createForeignKeys('messages', [
        new TableForeignKey({
          name: 'FK_messages_user',
          columnNames: ['userId'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'NO ACTION',
          onUpdate: 'NO ACTION',
        }),
        new TableForeignKey({
          name: 'FK_messages_room',
          columnNames: ['roomId'],
          referencedTableName: 'rooms',
          referencedColumnNames: ['id'],
          onDelete: 'NO ACTION',
          onUpdate: 'NO ACTION',
        }),
      ]);

      await queryRunner.createIndices('messages', [
        new TableIndex({ name: 'IDX_messages_userId', columnNames: ['userId'] }),
        new TableIndex({ name: 'IDX_messages_roomId', columnNames: ['roomId'] }),
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasMessages = await queryRunner.hasTable('messages');
    if (hasMessages) {
      const messagesTable = await queryRunner.getTable('messages');
      const userForeignKey = messagesTable?.foreignKeys.find((fk) => fk.name === 'FK_messages_user');
      const roomForeignKey = messagesTable?.foreignKeys.find((fk) => fk.name === 'FK_messages_room');

      if (userForeignKey) {
        await queryRunner.dropForeignKey('messages', userForeignKey);
      }
      if (roomForeignKey) {
        await queryRunner.dropForeignKey('messages', roomForeignKey);
      }

      await queryRunner.dropTable('messages');
    }

    const hasRooms = await queryRunner.hasTable('rooms');
    if (hasRooms) {
      await queryRunner.dropTable('rooms');
    }

    const hasUsers = await queryRunner.hasTable('users');
    if (hasUsers) {
      await queryRunner.dropTable('users');
    }
  }
}
