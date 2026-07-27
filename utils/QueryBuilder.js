const EXCLUDED_FILTER_KEYS = ['searchTerm', 'sort', 'sortBy', 'sortOrder', 'page', 'limit', 'fields'];

class QueryBuilder {
  constructor(modelQuery, query) {
    this.modelQuery = modelQuery;
    this.query = query || {};
  }

  search(searchableFields) {
    const searchTerm = this.query.searchTerm;

    if (searchTerm && searchableFields.length > 0) {
      this.modelQuery = this.modelQuery.find({
        $or: searchableFields.map((field) => ({
          [field]: { $regex: searchTerm, $options: 'i' }
        }))
      });
    }

    return this;
  }

  filter() {
    const queryObject = { ...this.query };
    EXCLUDED_FILTER_KEYS.forEach((key) => delete queryObject[key]);

    Object.keys(queryObject).forEach((key) => {
      if (queryObject[key] === undefined || queryObject[key] === '' || queryObject[key] === 'all') {
        delete queryObject[key];
      }
    });

    this.modelQuery = this.modelQuery.find(queryObject);

    return this;
  }

  sort(defaultSort = '-createdAt') {
    let sortValue = defaultSort;

    if (this.query.sortBy) {
      const direction = this.query.sortOrder === 'asc' ? '' : '-';
      sortValue = `${direction}${this.query.sortBy}`;
    } else if (this.query.sort) {
      sortValue = this.query.sort.split(',').join(' ');
    }

    this.modelQuery = this.modelQuery.sort(sortValue);

    return this;
  }

  paginate() {
    const page = Math.max(Number(this.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(this.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    this.page = page;
    this.limit = limit;
    this.modelQuery = this.modelQuery.skip(skip).limit(limit);

    return this;
  }

  fields() {
    if (this.query.fields) {
      this.modelQuery = this.modelQuery.select(this.query.fields.split(',').join(' '));
    }

    return this;
  }

  async countTotal() {
    const filters = this.modelQuery.getFilter();
    const total = await this.modelQuery.model.countDocuments(filters);
    const page = this.page || 1;
    const limit = this.limit || total || 1;

    return {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1
    };
  }
}

export default QueryBuilder;
