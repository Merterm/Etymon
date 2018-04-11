document.addEventListener('DOMContentLoaded', function() {
        var cy = cytoscape({
          container: document.getElementById('cy'),
          elements: [
            { data: { id: 'a' } },
            { data: { id: 'b' } },
            {
              data: {
                id: 'ab',
                source: 'a',
                target: 'b'
              }
            }],
            style: [
                {
                    selector: 'node',
                    style: {
                        shape: 'hexagon',
                        'background-color': 'red'
                    }
                }]
        });

        for (var i = 0; i < 200; i++) {
            cy.add({
                data: { id: 'node' + i }
                }
            );
            var source = 'node' + i;
            cy.add({
                data: {
                    id: 'edge' + i,
                    source: source,
                    target: (i % 2 == 0 ? 'a' : 'b')
                }
            });
        }

        cy.layout({
            name: 'cose'
        }).run();
});
