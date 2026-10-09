import { RowDataPacket } from 'mysql2';
export interface ItemData {
    item_code: string;
    name_ps: string;
    name_fa: string;
    description?: string;
    category_id: number;
    unit_id: number;
    warehouse_id: number;
    minimum_stock?: number;
}
export interface StockData {
    item_id: number;
    quantity: number;
    source_type?: string;
    notes?: string;
}
export declare class InventoryService {
    static getItems(filters: any): Promise<import("mysql2").QueryResult>;
    static getItemById(id: number): Promise<RowDataPacket | undefined>;
    static createItem(data: ItemData, userId: number | null): Promise<number>;
    static updateItem(id: number, data: Partial<ItemData>, userId: number | null): Promise<boolean>;
    static deleteItem(id: number, userId: number | null): Promise<boolean>;
    static stockIn(data: StockData, userId: number | null): Promise<{
        previous_stock: any;
        new_stock: any;
    }>;
    static stockOut(data: StockData, userId: number | null): Promise<{
        previous_stock: any;
        new_stock: number;
    }>;
    static getTransactions(filters: any): Promise<import("mysql2").QueryResult>;
    static getCategories(): Promise<import("mysql2").QueryResult>;
    static getUnits(): Promise<import("mysql2").QueryResult>;
    static getWarehouses(): Promise<import("mysql2").QueryResult>;
}
//# sourceMappingURL=inventory.service.d.ts.map