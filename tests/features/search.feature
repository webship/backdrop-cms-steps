@search
Feature: Search
  As a tester of a site
  I want to search with the search block and assert the results
  So that the search of the site is covered

  # The site build script places the "Search form" block in the header of the
  # default layout, lets visitors search and runs cron once, so the seeded
  # content is indexed.

  @critical
  Scenario: A visitor searches with the search block
    Given I am on "/visit-the-apiary"
    Then I should see the block titled "Search"
    When I search the site for "veil"
    Then the search results should list "Visit the apiary"
    And the search should find 1 result
    And the search results should not list "Opening hours"

  Scenario: A search with more results than a page holds
    Given I am on "/about"
    When I search the site for "observation"
    Then the search should find 10 results
    And I should see a pager
    When I go to the next page of the pager
    Then the search should find at least 1 result

  Scenario: Unpublished content is not found
    Given I am an anonymous user
    When I search the site for "review"
    Then the search results should not list "Unpublished field note"

  Scenario: A search without results says so
    Given I am on the homepage
    When I search the site for "zzzunknownwordzzz"
    Then the search should find no results
    And the search results should not list "Visit the apiary"

  Scenario: The search page is used when the page has no search block
    Given I am on the homepage
    When I search the site for "queen cells"
    Then the search results should list "Editor field note"
    And the page heading should be "Search"
