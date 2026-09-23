package com.personalusageanalytics.processor.icon;

import java.util.List;

public interface AppIconLookupClient {
    List<StoreApp> search(String term, String country) throws Exception;
}
