import { Request, Response } from 'express';
export declare const getItems: (req: Request, res: Response) => Promise<void>;
export declare const getItemById: (req: Request, res: Response) => Promise<any>;
export declare const createItem: (req: Request, res: Response) => Promise<any>;
export declare const updateItem: (req: Request, res: Response) => Promise<void>;
export declare const deleteItem: (req: Request, res: Response) => Promise<void>;
export declare const stockIn: (req: Request, res: Response) => Promise<any>;
export declare const stockOut: (req: Request, res: Response) => Promise<any>;
export declare const getTransactions: (req: Request, res: Response) => Promise<void>;
export declare const getCategories: (req: Request, res: Response) => Promise<void>;
export declare const getUnits: (req: Request, res: Response) => Promise<void>;
export declare const getWarehouses: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=inventory.controller.d.ts.map