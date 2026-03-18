import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class DropRoomsNameUnique1710721000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('rooms');
    if (!table) return;

    for (const index of table.indices) {
      if (index.isUnique && index.columnNames.length === 1 && index.columnNames[0] === 'name') {
        await queryRunner.dropIndex('rooms', index);
      }
    }

    const hasNameIdx = table.indices.some((idx) => idx.name === 'IDX_rooms_name');
    if (!hasNameIdx) {
      await queryRunner.createIndex(
        'rooms',
        new TableIndex({
          name: 'IDX_rooms_name',
          columnNames: ['name'],
          isUnique: false,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('rooms');
    if (!table) return;

    const plainNameIdx = table.indices.find((idx) => idx.name === 'IDX_rooms_name');
    if (plainNameIdx) {
      await queryRunner.dropIndex('rooms', plainNameIdx);
    }

    const hasUniqueName = table.indices.some(
      (idx) => idx.isUnique && idx.columnNames.length === 1 && idx.columnNames[0] === 'name',
    );
    if (!hasUniqueName) {
      await queryRunner.query('ALTER TABLE `rooms` ADD UNIQUE INDEX `UQ_rooms_name` (`name`)');
    }
  }
}

