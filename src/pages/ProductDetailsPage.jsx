import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useCart } from '../context/CartContext.jsx';

export default function ProductDetailsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setProduct(null);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          slug,
          category,
          description,
          price,
          compare_at_price,
          stock,
          image_url,
          tag
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        console.error('Product details loading error:', fetchError);
        setError('পণ্যের তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।');
      } else if (!data) {
        setError('এই পণ্যটি পাওয়া যায়নি অথবা বর্তমানে বিক্রির জন্য নেই।');
      } else {
        setProduct({
          ...data,
          price: Number(data.price),
          oldPrice:
            data.compare_at_price == null
              ? null
              : Number(data.compare_at_price),
          stock: Number(data.stock),
        });
      }

      setLoading(false);
    }

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleOrderNow = () => {
    if (!product || product.stock < 1) return;

    navigate('/checkout', {
      state: { directProduct: product },
    });
  };

  const handleAddToCart = () => {
    if (!product || product.stock < 1) return;
    addToCart(product);
  };

  return (
    <main className="rs-product-details-page">
      <style>{`
        .rs-product-details-page {
          min-height: 65vh;
          padding: 30px 0 70px;
          background: #faf9f5;
        }
        .rs-details-container {
          width: min(1100px, calc(100% - 40px));
          margin: 0 auto;
        }
        .rs-details-breadcrumb {
          margin-bottom: 25px;
          color: #747b72;
          font-size: 14px;
        }
        .rs-details-breadcrumb a {
          color: #174D35;
          text-decoration: none;
        }
        .rs-details-card {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          padding: 30px;
          background: #fff;
          border: 1px solid #eee9df;
          border-radius: 16px;
        }
        .rs-details-image {
          min-height: 390px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 12px;
          background: #f3f0e7;
        }
        .rs-details-image img {
          width: 100%;
          height: 390px;
          object-fit: contain;
        }
        .rs-details-info {
          align-self: center;
        }
        .rs-details-tag {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 20px;
          background: #e9dfc5;
          color: #72571d;
          font-size: 12px;
          margin-bottom: 14px;
        }
        .rs-details-category {
          color: #858b80;
          font-size: 13px;
          margin-bottom: 8px;
        }
        .rs-details-info h1 {
          color: #174D35;
          font-size: clamp(25px, 4vw, 34px);
          line-height: 1.3;
          margin: 0 0 18px;
        }
        .rs-details-price {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin: 20px 0;
        }
        .rs-details-price strong {
          color: #174D35;
          font-size: 28px;
        }
        .rs-details-price del {
          color: #999;
          font-size: 16px;
        }
        .rs-details-stock {
          margin: 18px 0;
          font-weight: 600;
          color: #286548;
        }
        .rs-details-stock.out {
          color: #b42318;
        }
        .rs-details-description {
          color: #626b63;
          line-height: 1.8;
          white-space: pre-line;
        }
        .rs-details-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 28px;
        }
        .rs-details-actions button {
          min-height: 48px;
          padding: 12px;
          border: 0;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
        }
        .rs-details-add {
          background: #174D35;
          color: #fff;
        }
        .rs-details-order {
          background: #D6A83E;
          color: #183b2b;
        }
        .rs-details-actions button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }
        .rs-details-message {
          max-width: 600px;
          margin: 50px auto;
          padding: 35px 20px;
          text-align: center;
          background: #fff;
          border: 1px solid #eee9df;
          border-radius: 14px;
          color: #626b63;
        }
        .rs-details-message h2 {
          color: #174D35;
        }
        .rs-details-back {
          display: inline-block;
          margin-top: 15px;
          color: #174D35;
          font-weight: 600;
          text-decoration: none;
        }
        @media (max-width: 700px) {
          .rs-details-card {
            grid-template-columns: 1fr;
            gap: 25px;
            padding: 18px;
          }
          .rs-details-image,
          .rs-details-image img {
            min-height: 280px;
            height: 280px;
          }
        }
        @media (max-width: 420px) {
          .rs-details-container {
            width: calc(100% - 28px);
          }
          .rs-details-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="rs-details-container">
        <div className="rs-details-breadcrumb">
          <Link to="/">Home</Link> / <Link to="/shop">Products</Link> / Product Details
        </div>

        {loading ? (
          <div className="rs-details-message">
            পণ্যের তথ্য লোড হচ্ছে...
          </div>
        ) : error ? (
          <div className="rs-details-message">
            <h2>Product Not Available</h2>
            <p>{error}</p>
            <Link className="rs-details-back" to="/shop">
              Back to Products
            </Link>
          </div>
        ) : product ? (
          <article className="rs-details-card">
            <div className="rs-details-image">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} />
              ) : (
                <span aria-hidden="true" style={{ fontSize: 100 }}>🧸</span>
              )}
            </div>

            <div className="rs-details-info">
              {product.tag && (
                <span className="rs-details-tag">{product.tag}</span>
              )}

              <p className="rs-details-category">{product.category}</p>
              <h1>{product.name}</h1>

              <div className="rs-details-price">
                <strong>
                  ৳{product.price.toLocaleString('en-BD')}
                </strong>

                {product.oldPrice > product.price && (
                  <del>
                    ৳{product.oldPrice.toLocaleString('en-BD')}
                  </del>
                )}
              </div>

              <p className={`rs-details-stock ${product.stock < 1 ? 'out' : ''}`}>
                {product.stock > 0
                  ? `In Stock: ${product.stock}`
                  : 'Out of Stock'}
              </p>

              {product.description ? (
                <p className="rs-details-description">
                  {product.description}
                </p>
              ) : (
                <p className="rs-details-description">
                  এই পণ্যের বিস্তারিত তথ্য শীঘ্রই যুক্ত করা হবে।
                </p>
              )}

              <div className="rs-details-actions">
                <button
                  type="button"
                  className="rs-details-add"
                  onClick={handleAddToCart}
                  disabled={product.stock < 1}
                >
                  Add to Cart
                </button>

                <button
                  type="button"
                  className="rs-details-order"
                  onClick={handleOrderNow}
                  disabled={product.stock < 1}
                >
                  Order Now
                </button>
              </div>
            </div>
          </article>
        ) : null}
      </div>
    </main>
  );
}

