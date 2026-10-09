import { useState, useEffect, useCallback } from "react";
import { Query, QuerySnapshot, DocumentData } from "firebase/firestore";
import { normalizeFirestoreError, safeGetDocs } from "../firebase/safeQuery";

interface QueryResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  empty: boolean;
  reload: () => void;
}

/**
 * Reusable hook for fetching Firestore collections safely.
 * Prevents infinite loading and handles common error/empty states.
 */
export function useFirestoreQuery<T>(
  queryInstance: Query | null,
  dependencies: any[] = []
): QueryResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  const fetchData = useCallback(async () => {
    if (!queryInstance) {
      // If no query is provided (e.g. waiting for user profile), don't set loading to false yet
      // but also don't crash.
      return;
    }

    setLoading(true);
    setError(null);
    setEmpty(false);

    try {
      const snapshot: QuerySnapshot<DocumentData> = await safeGetDocs(queryInstance);
      
      if (snapshot.empty) {
        setData([]);
        setEmpty(true);
      } else {
        const results = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as T[];
        setData(results);
        setEmpty(false);
      }
    } catch (err: any) {
      setError(normalizeFirestoreError(err));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [queryInstance]);

  useEffect(() => {
    fetchData();
  }, dependencies);

  return { data, loading, error, empty, reload: fetchData };
}
